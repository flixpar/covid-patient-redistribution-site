# API Reference

## Endpoints

**`/api/hospital-list`**

List hospitals with basic metadata (name, id, current load, beds) by region.

Parameters:
- `region_type` (string): filter hospitals by region (state/hrr/hsa/hospital_system)
- `region_id` (string): filter hospitals by region (region identifier)



**`/api/regions-list`**

List regions by region type.

Parameters:
- `region_type` (string): filter regions by type (state/hrr/hsa/hospital_system)



**`/api/hospital-selection`**

List the 20 nearest hospitals to the point specified with associated current load and capacity data.

Parameters:
- `lat` (float): user location latitude
- `long` (float): user location longitude



**`/api/region-selection`**

Computes summary statistics for load by region with and without patient redistribution that can be generated without running the optimization model.

Parameters:
- `region_type` (string): region type (state/hrr/hsa/hospital_system)
- `patient_type` (string): patient type (combined/icu/acute)
- `metric_type` (string): metric units (beds/beddays)
- `start_date` (string): date in yyyy-mm-dd format
- `end_date` (string): date in yyyy-mm-dd format



**`/api/patients`**

Patient redistribution API used for the "Dashboard" and "Customize Results" pages. Optimizes the number of patients transfered between hospitals selected using the parameters specified.

Parameters:
- `start_date` (string): date in yyyy-mm-dd format
- `end_date` (string): date in yyyy-mm-dd format
- `region_type` (string): filter hospitals by region (state/hrr/hsa/hospital_system)
- `region_id` (string): filter hospitals by region (region identifier)
- `hospitals` (list of strings, optional): list of hospital ids to include
- `scenario` (string): forecast scenario, only "moderate" is currently supported
- `patient_type` (string): patient group to focus on (combined/icu/acute/combined_ped)
- `objective` (string): optimization objective (minoverflow/minbedoverflow/loadbalance)
- `transfer_budget` (float): maximum number of patients to transfer per hospital-day
- `total_transfer_budget` (float): maximum number of patients to transfer in total
- `capacity_util` (float): proportion of capacity that can be used (default: 1)
- `covid_capacity_proportion` (float, optional): proportion of capacity that can be used for COIVD patients (default: 0.4)
- `dist_threshold` (float, optional): maximum distance a patient can be transfered in km
- `dist_cost` (float, optional): penalty for total distance of transfers (default: 0.05)
- `uncertainty_level` (string): level of uncertainty used in model (default: "default")
- `los` (string): length-of-stay distribution identifier (default_dist/regional_dist)
- `constrain_integer` (bool, optional): solve the problem as a MIP (default: false)
- `smoothness` (bool, optional): use smoothness penalty (default: true)
- `verbose` (bool, optional): controls level of logging on backend
