module DataLoader

using CSV
using JSON
using Serialization
using DataFrames
using Distributions
using Dates
using LinearAlgebra

export load_jhhs
export los_dist_default

basepath = joinpath(dirname(@__FILE__), "../")


function load_jhhs(
		scenario::Symbol,
		patient_type::Symbol,
		start_date::Date,
		end_date::Date,
	)
	@assert(start_date < end_date)
	@assert(patient_type in [:icu, :ward, :all])

	data = deserialize("data/data_jhhs.jlser")

	@assert data.start_date <= start_date < end_date <= data.end_date

	N = length(data.location_names)
	T = (end_date - start_date).value + 1

	hospitals = data.location_names
	hospitals_abbrev = data.location_names_short

	bedtype = (patient_type == :all) ? :allbeds : patient_type
	casesdata = data.casesdata[scenario,bedtype]

	start_date_idx = (start_date - data.start_date).value + 1
	end_date_idx   = (end_date   - data.start_date).value + 1
	admitted = casesdata.admitted[:,start_date_idx:end_date_idx]

	day0 = max(data.start_date, start_date - Day(1))
	day0_idx = (day0 - data.start_date).value + 1
	initial = casesdata.active[:, day0_idx]

	discharged = Array{Float64,2}(undef, N, T)
	for i in 1:N
		discharged[i,:] = initial[i] .* (pdf.(casesdata.los_dist, 0:T-1))
		if isinf(discharged[i,1])
			discharged[i,1] = 0.0
		end
	end

	beds = casesdata.beds
	capacity = casesdata.capacity

	adj = (data.dist_matrix .<= 1)
	node_locations = Dict(h => data.locations_latlong[h] for h in hospitals)

	extent = (extent_type = :states, extent_regions = ["Maryland"])

	return (
		initial = initial,
		discharged = discharged,
		admitted = admitted,
		beds = beds,
		capacity = capacity,
		adj = adj,
		node_locations = node_locations,
		node_names = hospitals,
		node_names_abbrev = hospitals_abbrev,
		extent = extent,
	)
end

function los_dist_default(bedtype::Symbol)
	if bedtype == :icu
		return Gamma(0.9875, 12.8990)
	elseif bedtype == :ward
		return Gamma(1.825, 3.772)
	else
		return Gamma(1.723, 4.154)
	end
end

end
