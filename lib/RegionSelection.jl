module RegionSelection

using Serialization
using DataFrames
using CSV
using Dates

using DataLoader: filter_hospitals

export regions_selection

projectbasepath = joinpath(@__DIR__, "../")


function regions_selection(region_type::Symbol, patient_type::Symbol, metrictype::Symbol, start_date::Date, end_date::Date)
	regions_all = deserialize(joinpath(projectbasepath, "data/regions_hhs.jlser"))
	regions = filter(r -> r.region_type == region_type, regions_all)

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	@assert patient_type in [:icu, :acute, :combined]

	start_date_idx = (start_date - data.start_date).value + 1
	end_date_idx   = (end_date   - data.start_date).value + 1

	@info "Region selection with rt: $(region_type), pt: $(patient_type), sd: $(start_date), ed: $(end_date)"

	results = map(regions) do region
		hospital_inds = filter_hospitals(data, region=region)

		cap = data.casesdata[:moderate, patient_type].covid_capacity[hospital_inds]
		occ = data.casesdata[:moderate, patient_type].active[hospital_inds, start_date_idx:end_date_idx]

		if metrictype == :beddays
			r = region_selection_metrics_beddays(cap, occ)
		elseif metrictype == :beds
			r = region_selection_metrics_beds(cap, occ)
		else
			error("Invalid metric type")
		end

		merge(region, r)
	end

	return results
end

function regions_selection(region_type::Symbol, patient_type::Symbol, date::Date)
	return regions_selection(region_type, patient_type, date, date)
end

function region_selection_metrics_beddays(cap, occ)
	cap_total = sum(cap)
	total_occ = sum(occ, dims=1)

	overflow_total = sum(max.(0, occ .- cap))
	overflow_ideal_total = sum(max.(0, total_occ .- cap_total))

	N, T = size(occ)
	overflow_total_pct = overflow_total / (cap_total * T)
	overflow_ideal_total_pct = overflow_ideal_total / (cap_total * T)

	benefits = max(0, overflow_total - overflow_ideal_total)
	benefits_pct = (overflow_total == 0) ? 0 : benefits / sum(overflow_total)

	occupancy_peak = maximum(total_occ)
	occupancy_total = sum(occ)

	capacity = sum(cap)

	load_peak_pct = occupancy_peak / capacity
	load_avg_pct = occupancy_total / (capacity * T)

	return (;overflow_total, overflow_total_pct, overflow_ideal_total, overflow_ideal_total_pct, benefits, benefits_pct, load_peak_pct, load_avg_pct, occupancy_peak, occupancy_total, capacity)
end

function region_selection_metrics_beds(cap, occ)
	cap_total = sum(cap)
	total_occ = sum(occ, dims=1)

	overflow_total = sum(maximum(max.(0, occ .- cap), dims=2))
	overflow_ideal_total = maximum(max.(0, total_occ .- cap_total))

	overflow_total_pct = overflow_total / cap_total
	overflow_ideal_total_pct = overflow_ideal_total / cap_total

	benefits = max(0, overflow_total - overflow_ideal_total)
	benefits_pct = (overflow_total == 0) ? 0 : benefits / overflow_total

	occupancy_peak = maximum(total_occ)
	occupancy_total = sum(occ)

	capacity = sum(cap)

	load_peak_pct = occupancy_peak / capacity
	load_avg_pct = occupancy_total / (capacity * size(occ, 2))

	return (;overflow_total, overflow_total_pct, overflow_ideal_total, overflow_ideal_total_pct, benefits, benefits_pct, load_peak_pct, load_avg_pct, occupancy_peak, occupancy_total, capacity)
end

end