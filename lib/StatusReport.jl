module StatusReport

using Dates
using Serialization
using DataFrames

using DataLoader: filter_hospitals, haversine_distance_matrix
using RegionSelection: regions_selection

export status_report_metrics

projectbasepath = joinpath(@__DIR__, "../")


function status_report(start_date, end_date)
	region_types = [:state, :hrr, :hsa, :hospital_system]
	patient_types = [:icu, :acute]
	metric_types = [:beds, :beddays]

	for rt in region_types, pt in patient_types, mt in metric_types
		regions = regions_selection(rt, pt, mt, start_date, end_date)
		sort!(regions, by=(r -> r.benefits), rev=true)
		top_regions = regions[1:10]
	end

	return
end

function status_report_metrics(date_current)
	rawdata = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	date_prev = date_current - Day(6)
	date_next = date_current + Day(6)
	date_ind = d -> (d - rawdata.start_date).value + 1

	patient_type = :icu
	data = rawdata.casesdata[:moderate, patient_type]

	cap = data.covid_capacity

	occ_prev = data.active[:, date_ind(date_prev):date_ind(date_current)]
	occ_next = data.active[:, date_ind(date_current):date_ind(date_next)]

	arr_prev = data.admitted[:, date_ind(date_prev):date_ind(date_current)]
	arr_next = data.admitted[:, date_ind(date_current):date_ind(date_next)]

	shortage_prev = sum(max.(0, occ_prev .- cap), dims=2)
	shortage_next = sum(max.(0, occ_next .- cap), dims=2)

	return (;
		shortage_prev = sum(shortage_prev),
		shortage_next = sum(shortage_next),
		n_shortage_prev = sum(shortage_prev .> 0),
		n_shortage_next = sum(shortage_next .> 0),
		arrivals_prev = sum(arr_prev),
		arrivals_next = sum(arr_next),
		n_hospitals = length(cap),
		date_current, date_prev, date_next,
	)
end

end
