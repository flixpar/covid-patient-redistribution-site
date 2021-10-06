module RegionSelection

using Serialization
using DataFrames
using Dates

using DataLoader: filter_hospitals

export regions_selection

projectbasepath = joinpath(@__DIR__, "../")


function regions_selection(region_type::Symbol, patient_type::Symbol, metrictype::Symbol, start_date::Date, end_date::Date)
	regions_all = deserialize(joinpath(projectbasepath, "data/regions_hhs.jlser"))
	regions = filter(r -> r.region_type == region_type, regions_all)

	data = deserialize(joinpath(projectbasepath, "data/data_hhs.jlser"))

	@assert patient_type in [:icu, :acute, :combined]
	covid_capacity_prop = (patient_type == :icu) ? 0.3 : (patient_type == :acute) ? 0.5 : 0.4

	start_date_idx = (start_date - data.start_date).value + 1
	end_date_idx   = (end_date   - data.start_date).value + 1

	results = map(regions) do region
		hospital_inds = filter_hospitals(data, region=region)

		cap = data.casesdata[:moderate, patient_type].beds[hospital_inds] .* covid_capacity_prop
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

	overflow_total_pct = overflow_total / (cap_total * T)
	overflow_ideal_total_pct = overflow_ideal_total / (cap_total * T)

	benefits = overflow_total - overflow_ideal_total
	benefits_pct = (overflow_total == 0) ? 0 : benefits / sum(overflow_total)

	return (;overflow_total, overflow_total_pct, overflow_ideal_total, overflow_ideal_total_pct, benefits, benefits_pct)
end

function region_selection_metrics_beds(cap, occ)
	cap_total = sum(cap)
	total_occ = sum(occ, dims=1)

	overflow_total = sum(maximum(max.(0, occ .- cap), dims=2))
	overflow_ideal_total = maximum(max.(0, total_occ .- cap_total))

	overflow_total_pct = overflow_total / cap_total
	overflow_ideal_total_pct = overflow_ideal_total / cap_total

	benefits = overflow_total - overflow_ideal_total
	benefits_pct = (overflow_total == 0) ? 0 : benefits / overflow_total

	return (;overflow_total, overflow_total_pct, overflow_ideal_total, overflow_ideal_total_pct, benefits, benefits_pct)
end

end