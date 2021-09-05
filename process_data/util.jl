using DataFrames
using Distributions
using Glob
using Dates


mean(xs) = sum(xs) / length(xs)

isbad(x) = isnothing(x) || ismissing(x) || isnan(x) || isinf(x)
isnbad(x) = !(isbad(x))
skipbad(xs) = filter(isnbad, xs)

function flatten(xs::Array; dims=-1)
	ds = size(xs)
	d = length(ds)

	if dims isa Int && dims <= 0
		ds = filter(!=(1), ds)
	elseif dims isa Int
		@assert ds[dims] == 1
		mask = setdiff(1:d, [dims])
		ds = ds[mask]
	else
		@assert all(ds[dims] .== 1)
		mask = setdiff(1:d, dims)
		ds = ds[mask]
	end

	xs = reshape(xs, ds...)
	return xs
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

function interpolate_missing(xs::AbstractArray{Union{Float64,Missing},3})
	output = Array{Float64,3}(undef, size(xs)...)
	for i in 1:size(xs,1), j in 1:size(xs,3)
		interpolate_missing(xs[i,:,j], @view output[i,:,j])
	end
	return output
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

function latest_hhs_rawdata_date()
	paths = glob("../rawdata/hospitalization_data/COVID-19_Reported_Patient_Impact_and_Hospital_Capacity_by_Facility_*.csv")
	if isempty(paths) return nothing end
	dates = [basename(p)[end-13:end-4] for p in paths]
	dates = [Date(d) for d in dates]
	date = maximum(dates)
	return date
end

function latest_hhs_rawdata_fn()
	date = latest_hhs_rawdata_date()
	if isnothing(date) return nothing end
	fn = "../rawdata/hospitalization_data/COVID-19_Reported_Patient_Impact_and_Hospital_Capacity_by_Facility_$(date).csv"
	return fn
end

function latest_forecast_date()
	paths = glob("../rawdata/forecasts/*-COVIDhub-ensemble.csv")
	if isempty(paths) return nothing end
	date_strs = [basename(p)[1:10] for p in paths]
	dates = [Date(d) for d in date_strs]
	date = maximum(dates)
	return date
end
