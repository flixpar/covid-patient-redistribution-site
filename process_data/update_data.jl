include("download.jl")
include("convert_hhs.jl")
include("capacity.jl")
include("los.jl")
include("metadata.jl")
include("forecast.jl")
include("package.jl")


println("Downloading HHS data")
hhs_updated = download_hhs_latest()
println("Downloading forecast")
forecast_updated = download_forecast_latest()

if !hhs_updated && !forecast_updated
	println("No new data.")
end

println("Converting HHS Data")
convert_hhs_data()

println("Estimating capacity")
estimate_capacity()
estimate_covid_capacity()
extract_capacity_timeseries()

println("Estimating LOS")
estimate_los()

println("Extracting metadata")
extract_metadata()
extract_regions_metadata()

println("Disaggregating forecast")
convert_cases()
disaggregate_forecast()

println("Packaging main data")
package_main_data()
extract_dates_metadata()

println("Packaging load data")
package_load_data()
println("Packaging COVID load data")
package_covid_load_data()
