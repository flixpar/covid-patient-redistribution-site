include("download.jl")
include("convert_data.jl")
include("capacity.jl")
include("metadata.jl")
include("package.jl")


println("Downloading data")
data_updated = download_rawdata()

if !data_updated
	println("No new data.")
	exit()
end

println("Extracting metadata")
extract_metadata()

println("Converting raw data")
convert_data()

println("Extracting additional metadata")
extract_regions_metadata()
extract_dates_metadata()

println("Estimating capacity")
estimate_capacity()

println("Packaging main data")
package_main_data()

println("Packaging load data")
package_load_data()
println("Packaging COVID load data")
package_covid_load_data()
