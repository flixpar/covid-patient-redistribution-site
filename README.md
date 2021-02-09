# Maryland COVID-19 Patient Redistribution Site
Felix Parker, Fardin Ganjkhanloo, Farzin Ahmadi, and Kimia Ghobadi

The COVID-19 pandemic has put a significant strain on healthcare systems around the globe. To mitigate the pressure, healthcare facilities responded by reducing demand – through canceling elective procedures – and by increasing capacity – through adding new beds suitable for COVID-19 patients and increasing staffing. While these measures have proven to be effective, increasing capacity is costly, slow, may decrease the quality of care, and may not be feasible for all healthcare centers. Delays in elective care may also result in adverse effects for patients. We aim to take a step toward a more coherent response from healthcare systems in these times of chronic demand surge.

To this end we have built models that can determine optimal patient transfers between hospitals. Patient transfers have potential to redistribute load between hospitals so that all existing capacity can be used effectively before any hospitals need to add surge capacity. This can significantly reduce the burden on hospitals facing a particularly large load, helping both the hospital and its patients, while not pushing any other hospitals over their capacity.

To demonstrate the efficacy of this approach, we have developed this website. Users may try different regions and inputs to the model, and explore the results that optimal patient transfers could have in practice.
The URL for this website is: https://covid-hospital-operations.com

---

Run the server locally with:
```
julia src/server.jl
```
