// script.js (located in src/scripts)

// Add event listeners to navigation menu items
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-link');
    navItems.forEach(function(item) {
      item.addEventListener('click', function(event) {
        event.preventDefault();
        console.log('Navigation item clicked:', item.textContent);
        // Add active class to the clicked navigation item
        navItems.forEach(function(navItem) {
          navItem.classList.remove('active');
        });
        item.classList.add('active');
      });
    });
  });
  
  // Add event listeners to buttons
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(function(button) {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      console.log('Button clicked:', button.textContent);
    });
  });
  
  // Add event listener to the header image
  const headerImage = document.querySelector('.header img');
  headerImage.addEventListener('click', function(event) {
    console.log('Header image clicked!');
  });
  
  // Add event listener to the overlay
  const overlay = document.querySelector('.overlay');
  overlay.addEventListener('click', function(event) {
    console.log('Overlay clicked!');
  });
  
  // Add event listener to the cards
  const cards = document.querySelectorAll('.card');
  cards.forEach(function(card) {
    card.addEventListener('click', function(event) {
      console.log('Card clicked:', card.querySelector('.card-title').textContent);
    });
  });
  
  // Add event listener to the footer social media icons
  const socialIcons = document.querySelectorAll('.social-icons a');
  socialIcons.forEach(function(icon) {
    icon.addEventListener('click', function(event) {
      event.preventDefault();
      console.log('Social media icon clicked:', icon.textContent);
    });
  });