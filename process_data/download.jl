using Downloads
using JSON
using Dates

include("util.jl")


function download_hhs_latest(;DEBUG=true)
	if DEBUG return true end

	meta_url = "https://healthdata.gov/api/views/anag-cw7u.json"
	tmp_fn = Downloads.download(meta_url)
	meta = JSON.parsefile(tmp_fn)
	modified_ts = meta["viewLastModified"]
	modified_date = Date(unix2datetime(modified_ts))
	realdata_fn = "../rawdata/hospitalization_data/COVID-19_Reported_Patient_Impact_and_Hospital_Capacity_by_Facility_$(modified_date).csv"

	prev_fn = latest_hhs_rawdata_fn()
	if prev_fn == realdata_fn
		return false
	end

	realdata_url = "https://healthdata.gov/api/views/anag-cw7u/rows.csv?accessType=DOWNLOAD"
	Downloads.download(realdata_url, realdata_fn)

	return true
end

function download_forecast_latest(;DEBUG=true)
	if DEBUG return true end

	forecast_url(d) = "https://raw.githubusercontent.com/reichlab/covid19-forecast-hub/master/data-processed/COVIDhub-ensemble/$(d)-COVIDhub-ensemble.csv"
	forecast_path(d) = "../rawdata/forecasts/$(d)-COVIDhub-ensemble.csv"

	latest_date = Date(now())
	tmp_path = ""
	dl_success = false
	while !dl_success
		try
			tmp_path = Downloads.download(forecast_url(latest_date))
			dl_success = true
		catch
			latest_date -= Day(1)
		end
	end

	prev_date = latest_forecast_date()
	if prev_date >= latest_date
		return false
	end

	mv(tmp_path, forecast_path(latest_date))

	cases_url = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv"
	Downloads.download(cases_url, "../rawdata/time_series_covid19_confirmed_US.csv")

	return true
end
