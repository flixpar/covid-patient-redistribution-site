document.addEventListener("DOMContentLoaded", () => {
	const navbarBurger = document.querySelector(".navbar-burger");
	if (navbarBurger == null) {return;}

	navbarBurger.addEventListener("click", () => {
		const targetId = navbarBurger.dataset.target;
		const target = document.getElementById(targetId);

		navbarBurger.classList.toggle("is-active");
		target.classList.toggle("is-active");
	});
});