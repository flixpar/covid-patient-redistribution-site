document.addEventListener("DOMContentLoaded", () => {
	const navbarBurger = document.querySelector(".navbar-burger");
	if (navbarBurger == null) {return;}

	navbarBurger.addEventListener("click", () => {
		const targetId = navbarBurger.dataset.target;
		const target = document.getElementById(targetId);

		navbarBurger.classList.toggle("is-active");
		target.classList.toggle("is-active");
	});

	document.querySelectorAll("#navbar-main > .navbar-item").forEach(elem => {
		if (window.location.pathname == elem.pathname) {
			elem.classList.add("is-active");
		}
	});

	document.querySelector(".navbar-dropdown").addEventListener("click", () => document.activeElement.blur());	
});