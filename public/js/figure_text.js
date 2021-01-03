const transfersSankeyDescription = `
The ribbons show the volume of patients that should be moved between hospitals. “Other Hospitals” refers to the rest of the hospitals in the selected state that were not chosen by the user to be displayed.
`;

const ridgeplotDescription = `
This figure shows the net number of COVID patients sent and received by each location over time. Areas shaded green represent times when a location is receiving more patients than it is sending, whereas areas shaded red represent times when a location is sending more patients than it is receiving.
`;

const activeplotDescription = `
The following figures illustrate the number of hospitalized COVID patients (per day) for each healthcare facility. The blue curve shows the forecasted number of patients (without any transfers) and the green shows this number assuming optimal transfers are made. The horizontal line shows the reported capacity for each facility. Note that hospitals that are over capacity (blue curve above the capacity line) can expect that the load will be lightened with optimal transfers as patients are transferred out. Hospitals that are within capacity (blue curve under the capacity line) will receive additional patients and the green curve will be closer (but still under) the capacity line. The goal is to distribute the load within the system instead of having some healthcare facilities be overwhelmed with patients while other hospitals have excess capacity that can be used.
`;

const overallloadplotDescription = `
The occupancy forecast of the entire state for the time duration of choice.
<br>
<b>How to read this figure:</b> When the occupancy (blue curve) is in the green region, the occupancy level (ICU or Acute COVID-19 beds, depending on what was selected above) is within the capacity of the state. If it enters the red region, there will be a bed shortage.
<br>
<b>Insights:</b> If the blue curve enters the red region, the state needs to increase bed capacity to be able to meet the predicted demand. The date and the minimum required additional beds depend on when the blue curve starts to enter the red zone and by how far it surpasses the current capacity (the red line).
`;

const loadplotsDescription = `
The occupancy forecast for each hospital (as selected above) for the time duration of choice. Left figure displays the occupancy when patients are not transferred, and the right figure displays occupancy when optimal patient transfers is utilized.
<br>
<b>How to read this figure:</b> When the occupancy of a hospital (the thinner curves) enter the green region, the occupancy level of that hospital (ICU, Acute, or total COVID-19 beds) is within the capacity of the hospital.
<br>
<b>Insights for individual hospitals:</b> If a hospital enters the red region, there will be a bed shortage at that hospital. The shortage can be mitigated by either adding more COVID-19 beds (left figure) or optimally transferring patients to other hospitals that have extra capacity (right figure).
`;

const overflowmapDescription = `
A map of the daily predicted required additional COVID-19 beds for each selected hospital with and without optimal transfers (right and left maps, respectively).
<br>
<b>How to read this figure:</b> The green dot indicates that the hospital will operate within capacity on the displayed date. A red dot, conversely, means that the hospital requires additional beds. The darker the red, the more beds are needed. These bed shortages can be mitigated by utilizing the available capacity in near-by hospitals by transferring patients (the figure on the right). The arrows (and their thickness) show where (and how many) patients should be moved to minimize the bed shortage. “Other Hospitals” refers to the rest of the hospitals that were not chosen by the user to be visualized.
<br>
<b>Insights:</b> The hospitals that become red in the right figure will need additional COVID-19 beds added.
`;

const dashboardDescription = ``;

const transfersDescription = ``;

const admittedDescription = ``;

const metricsDescription = ``;

const surgeTimelineDescription = ``;
