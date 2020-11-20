module DataLoader

using CSV
using JSON
using Serialization
using DataFrames
using Distributions
using Dates
using LinearAlgebra

using BedsData
using ForecastData
using NurseData
using GeographicData

export load_hospital_level

basepath = joinpath(dirname(@__FILE__), "../")


function load_jhhs(
		start_date::Date,
		end_date::Date,
		patient_type::Symbol,
		pct_beds_available::Real,
		travel_threshold_hours::Real,
	)
	@assert(start_date < end_date)
	@assert(0 < pct_beds_available <= 1)
	@assert(0 < travel_threshold_hours)
	@assert(patient_type in [:icu, :ward, :all])

	data = deserialize("data/data_jhhs.jlser")

	@assert data.start_date <= start_date < end_date <= data.end_date

	N = data.N
	T = (end_date - start_date).value + 1

	hospitals = data.hospital_names_full
	hospitals_abbrev = data.hospital_names_abbrev

	if patient_type == :icu
		casesdata = data.data_icu
	elseif patient_type == :ward
		casesdata = data.data_ward
	else
		casesdata = data.data_combined
	end

	start_date_idx = (start_date - data.start_date).value + 1
	end_date_idx   = (end_date   - data.start_date).value + 1
	admitted = casesdata.admitted[:,start_date_idx:end_date_idx]

	day0 = max(data.start_date, start_date - Day(1))
	day0_idx = (day0 - data.start_date).value + 1
	initial = casesdata.active[:, day0_idx]

	discharged = Array{Float64,2}(undef, N, T)
	for i in 1:N
		discharged[i,:] = initial[i] .* (pdf.(casesdata.discharged_los, 0:T-1))
	end

	beds = casesdata.beds .* pct_beds_available

	adj = (data.dist_matrix .<= travel_threshold_hours)
	node_locations = Dict(hospitals[i] => data.locations_latlong[j] for (i,j) in enumerate(loc_inds))

	extent = (extent_type = :states, extent_regions = ["Maryland"])

	return (
		initial = initial,
		discharged = discharged,
		admitted = admitted,
		beds = beds,
		adj = adj,
		node_locations = node_locations,
		node_names = hospitals,
		node_names_abbrev = hospitals_abbrev,
		extent = extent,
	)
end

end
