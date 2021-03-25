using CSV
using Dates
using DataFrames

include("util.jl")


############################
#### Estimate Capacity #####
############################

function estimate_capacity()
	rawdata_fn = latest_hhs_rawdata_fn()
	rawdata = DataFrame(CSV.File(rawdata_fn))

	bad_ids = begin
		id_counts = combine(groupby(rawdata, :hospital_pk), :hospital_name => (x -> length(unique(x))) => :n_names)
		filter!(x -> x.n_names > 1, id_counts)
		unique(id_counts.hospital_pk)
	end
	filter!(row -> !(row.hospital_pk in bad_ids), rawdata)

	data = select(rawdata,
		:hospital_name => :hospital,
		:hospital_pk => :hospital_id,
		:collection_week => ByRow(d -> Date(d, "yyyy/mm/dd")) => :date,
		:all_adult_hospital_inpatient_beds_7_day_avg => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :beds_allbeds,
		:total_staffed_adult_icu_beds_7_day_avg => ByRow(x -> (ismissing(x) || x == -999999) ? missing : x) => :beds_icu,
	)
	data.beds_acute = max.(0, data.beds_allbeds - data.beds_icu)
	sort!(data, [:hospital, :hospital_id, :date])

	start_date = Date(2020,  7, 1)
	end_date   = Date(2020, 11, 1)
	date_range = collect(start_date : Day(1) : end_date)

	function mean_capacity(xs, dates)
		xs = [x for (x,d) in zip(xs,dates) if d in date_range]
		if all(ismissing.(xs))
			return 0
		else
			xs = filter(x -> !ismissing(x), xs)
			return round(Int, sum(xs) / length(xs))
		end
	end

	function max_capacity(xs)
		if all(ismissing.(xs))
			return 0
		else
			return maximum(skipmissing(xs))
		end
	end

	function min_capacity(xs)
		if all(ismissing.(xs))
			return 0
		else
			return minimum(skipmissing(xs))
		end
	end

	capacity_data = combine(groupby(data, [:hospital, :hospital_id]), [
		:beds_icu => min_capacity => :beds_icu_min,
		:beds_acute => min_capacity => :beds_acute_min,
		:beds_allbeds => min_capacity => :beds_allbeds_min,

		[:beds_icu, :date] => mean_capacity => :beds_icu_mean,
		[:beds_acute, :date] => mean_capacity => :beds_acute_mean,
		[:beds_allbeds, :date] => mean_capacity => :beds_allbeds_mean,

		:beds_icu => max_capacity => :beds_icu_max,
		:beds_acute => max_capacity => :beds_acute_max,
		:beds_allbeds => max_capacity => :beds_allbeds_max,
	])

	capacity_names_icu = [:beds_icu_min, :beds_icu_mean, :beds_icu_max]
	capacity_names_acute = [:beds_acute_min, :beds_acute_mean, :beds_acute_max]
	capacity_names_allbeds = [:beds_allbeds_min, :beds_allbeds_mean, :beds_allbeds_max]

	sort!(capacity_data, [:hospital, :hospital_id])

	capacity_data_long = stack(capacity_data, Not([:hospital, :hospital_id]), variable_name=:capacity_name, value_name=:capacity_value)

	capacity_data_long_icu = filter(row -> Symbol(row.capacity_name) in capacity_names_icu, capacity_data_long)
	capacity_data_long_acute = filter(row -> Symbol(row.capacity_name) in capacity_names_acute, capacity_data_long)
	capacity_data_long_allbeds = filter(row -> Symbol(row.capacity_name) in capacity_names_allbeds, capacity_data_long)

	capacity_data_output = select(capacity_data, :hospital, :hospital_id, :beds_icu_mean => :capacity_icu, :beds_acute_mean => :capacity_acute, :beds_allbeds_mean => :capacity_allbeds)

	filter!(row -> row.capacity_icu + row.capacity_acute + row.capacity_allbeds > 0, capacity_data_output)

	capacity_data_output |> CSV.write("../data/capacity_hhs.csv")

	return
end
