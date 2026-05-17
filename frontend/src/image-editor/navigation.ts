// Typed Image editor module: navigation.
// Keeps behavior compatible while the monolith is split into smaller files.

// ===== NAVBAR NAVIGATION HANDLER =====
function handleImageNavClick(event: Event): boolean {
    // If already on /image page, prevent reload
    if (window.location.pathname.startsWith('/image')) {
        event.preventDefault();
        console.log('Already on image page, prevented reload');
        return false;
    }
    return true; // Allow navigation if on different page
}
