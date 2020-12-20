const transfersSankeyDescription = `
This figure shows the total number of COVID patients transferred between hospitals over the time period considered. Ribbons connect locations that are sending patients (on the left) with locations that are receiving patients (on the right), where the relative widths represent the number of patients sent.
`;

const ridgeplotDescription = `
This figure shows the net number of COVID patients sent and received by each location over time. Areas shaded green represent times when a location is receiving more patients than it is sending, whereas areas shaded red represent times when a location is sending more patients than it is receiving.
`;

const activeplotDescription = `
The following figures illustrate the number of hospitalized COVID patients (per day) for each healthcare facility. The blue curve shows the forecasted number of patients (without any transfers) and the green shows this number assuming optimal transfers are made. The horizontal line shows the reported capacity for each facility. Note that hospitals that are over capacity (blue curve above the capacity line) can expect that the load will be lightened with optimal transfers as patients are transferred out. Hospitals that are within capacity (blue curve under the capacity line) will receive additional patients and the green curve will be closer (but still under) the capacity line. The goal is to distribute the load within the system instead of having some healthcare facilities be overwhelmed with patients while other hospitals have excess capacity that can be used.
`;

const overallloadplotDescription = `
This figure shows the overall load of the system relative to its capacity for COVID patients. When the COVID load (blue) is in the green region, the system is under capacity and can accomadate all COVID patients without needing additional capacity. When the blue line is in the red region, the system is over capacity and must create additional capacity for COVID patients. Note that since transfers only move patients around within the system, they can only help individual hospitals and not the system as a whole, so this line is constant regardless of how many transfers are made. Optimal transfers can be most impactful when the load (blue) is near the capacity line (red) because this indicates that some hospitals will be over capacity and need to transfer patients out and some hospitals will be under capacity and able to accept transfers.
`;

const loadplotsDescription = `
This figure displays the load on each individual hospital, which is the number of COVID patients divided by the number of beds available to COVID patients. A load greater than 1 (over the red line) means that the hospital will run out of beds for COVID patients, and will need to transfer patients or add more beds, while a load less than 1 (under the red line) means that the hospital has extra capacity for COVID patients. On the left is the forecasted load, which is what the forecast model predicts will happen if no transfers are made. On the right is the projected load at each hospital assuming optimal transfers are made. If optimal transfers are made, hospitals will only go over capacity if there is no space left for their patients anywhere in the system or if there are sufficiently good operational reasons to keep the additional patients where they are.
`;

const overflowmapDescription = `
These maps show how much surge capacity will have to be created at each hospital. Each point represents a hospital, and each hospital is colored depending on how many additional beds it needs to care for all of its COVID patients. Green indicates that a hospital is under capacity, and does not need any additional beds, while darker shades of red indicate that a hospital needs more beds. The figure on the left assumes no transfers are made, and the figure on the right assumes that optimal patient transfers are made. The arrows represent transfers, where the width of the arrow corresponds to the number of patients sent.
`;

const dashboardDescription = ``;

const transfersDescription = ``;

const admittedDescription = ``;

const metricsDescription = ``;
