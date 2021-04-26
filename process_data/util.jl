using DataFrames
using Distributions
using Glob
using Dates


mean(xs) = sum(xs) / length(xs)

isbad(x) = isnothing(x) || ismissing(x) || isnan(x) || isinf(x)
isnbad(x) = !(isbad(x))
skipbad(xs) = filter(isnbad, xs)

function lastvalue(xs)
	i = findlast(x -> !ismissing(x), xs)
	v = isnothing(i) ? 0 : xs[i]
	return v
end

function interpolate_timeseries_linear(xs_, ys)
	x_start = xs_[1]
	xs = [(x-x_start).value for x in xs_]

	tx = length(xs)

	d_start, d_end = xs[1], xs[end]
	ds = 0 : (d_end-d_start)

	td = length(ds)
	zs = zeros(Union{Float64,Missing}, td)

	for (i,d) in enumerate(ds)
		x1_ind = findlast(q -> q <= d, xs)
		x1_ind = isnothing(x1_ind) ? tx : x1_ind

		x1 = xs[x1_ind]
		x2 = xs[min(x1_ind+1, tx)]

		y1 = ys[x1_ind]
		y2 = ys[min(x1_ind+1, tx)]

		m = (x1==x2) ? 0 : (y2-y1) / (x2-x1)
		z = (m * (d-x1)) + y1
		zs[i] = max(0, z)
	end

	return zs
end

function interpolate_missing(xs::AbstractArray{Float64})
	return xs
end

function interpolate_missing(xs::AbstractArray{Union{Float64,Missing},2})
	output = Array{Float64,2}(undef, size(xs)...)
	for i in 1:size(xs,1)
		interpolate_missing(xs[i,:], @view output[i,:])
	end
	return output
end

function interpolate_missing(xs::AbstractArray{Union{Float64,Missing},1})
	dest = Array{Float64,1}(undef, length(xs))
	return interpolate_missing(xs, dest)
end

function interpolate_missing(xs::AbstractArray{Union{Float64,Missing},1}, dest::AbstractArray{Float64,1})
	@assert length(xs) == length(dest)

	if all(isbad.(xs))
		fill!(dest, 0.0)
		return dest
	end

	for i in 1:length(xs)
		if isbad(xs[i])
			a = findprev(isnbad, xs, i)
			b = findnext(isnbad, xs, i)

			a = isnothing(a) ? b : a
			b = isnothing(b) ? a : b

			m = (a==b) ? 0 : ((xs[b]-xs[a]) / (b-a))
			dest[i] = (m * (i-a)) + xs[a]
		else
			dest[i] = xs[i]
		end
	end

	return dest
end

function interpolate_missing(df::AbstractDataFrame)
	for col in valuecols
		df[!,col] = interpolate_missing(df[!,col])
	end
	return df
end

function estimate_active(initial, admitted, los_dist)
	T = length(admitted)

	discharged = initial .* (pdf.(los_dist, 0:T-1))
	if !ismissing(discharged[1]) && isinf(discharged[1])
		discharged[1] = 0.0
	end

	L = 1.0 .- cdf.(los_dist, 0:T)

	active = [(
		initial
		- sum(discharged[1:t])
		+ sum(L[t-t₁+1] * admitted[t₁] for t₁ in 1:t)
	) for t in 1:T]

	return active
end

function latest_update_date()
	paths = glob("../rawdata/*/")
	dates = map(paths) do p
		d = p[end-10:end-1]
		try
			d = Date(d)
		catch
			d = nothing
		end
		d
	end
	filter!(d -> !isnothing(d), dates)
	date = maximum(dates)
	return date
end
