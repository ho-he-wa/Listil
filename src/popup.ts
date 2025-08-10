
document.querySelector('#click-me')?.addEventListener('click', () => {
    const testDisplay = document.querySelector('#test-display');
    if (testDisplay) {
        testDisplay.innerHTML = new Date().toString()
    }
}
);