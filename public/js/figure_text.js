const transfersSankeyDescription = `
This figure shows the relative numbers of patients transferred between locations over the selected time window. Ribbons connect locations that are sending patients (on the left) with locations that are receiving patients (on the right), where the relative widths represent the number of patients sent.
`;

const ridgeplotDescription = `
This figure shows the net number of patients sent and received by each location over time. Areas shaded green represent times when a location is receiving more patients than it is sending (it has excess capacity), whereas areas shaded red represent times when a location is sending more patients than it is receiving (it is at or over capacity).
`;

const activeplotDescription = `
The following figures illustrate the number of hospitalized patients (per day) for each healthcare facility. The blue curve shows the number of patient without any transfers (the historical number of patients) and the green shows this number after the optimal transfers. The red line shows the reported capacity for each facility. Note that hospitals that are over capacity (blue curve above the red line) can expect that the load will be lightened with optimal transfers as patients are transferred out. Hospitals that are within capacity (blue curve under the red line) will receive additional patients and the green curve will be closer (but still under) the red line of capacity. The goal is to distribute the load within the systems instead of having some healthcare facilities be over-whelmed with patients while other hospitals have some capacity that can be used.
`;

const overallloadplotDescription = `
When the number of patients rise significantly, even with an optimal and 100% patient transfers, the number of hospitalized patients might surpass the overall capacity that is available in the entire healthcare system. In such cases, it becomes necessary for the system to create new capacity. This scenario can be captured in the figure below, when the number of hospitalized patients (the blue curve) surpasses the total capacity of all the hospitals in the system (the red line).
`;

const loadplotsDescription = `
Similar to the overall load to the system, the load on every individual hospital can also be studied, with and without patient transfers (right and left figure, respectively). If after optimal patient transfers (the right figure), the number of patients in a hospital surpasses the capacity of it (i.e., the curve for the hospital rises above the red normalized capacity line), then the capacity of the hospital needs to be increased to meet the demands. Note that while the overall system might be within capacity, individual hospitals might exceed their capacity due to operational constraints and the distributed capacity.
`;

const overflowmapDescription = `
The daily required surge capacity with optimal patient transfers (right figure) is compared with the historical data (left figure) for every day during the selected time window. The green color indicates an area is within capacity and the red color shows the level of additional capacity required. The darker the red, the more capacity is needed. The goal is to keep the entire region in green, if possible, or light red. The arrows show the optimal patient transfers, with widths corresponding to the number of patients transferred.
`;

const dashboardDescription = ``;

const transfersDescription = ``;

const admittedDescription = ``;

const metricsDescription = ``;
