// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('search') || '';

// Track current data and page count
let allSneakers = [];
let filteredSneakers = [];
let displayedCount = 0;
const itemsPerPage = 30;
let siteOptions = [];

// Currency conversion rates (approximate)

// Currency conversion rates (default)
const exchangeRates = {
    'usd': 1,
    'inr': 80 // Default fallback value
};

// Function to fetch exchange rate and update the dictionary
async function fetchExchangeRate() {
    const rate_url = "https://api.exchangerate-api.com/v4/latest/USD";
    try {
        const response = await fetch(rate_url);
        const data = await response.json();
        exchangeRates.inr = data.rates.INR; // Update INR value in the dictionary
    } catch (error) {
        console.error("Error fetching exchange rate:", error);
    }
}


// Update the search query text and input field
document.getElementById('search-query-text').textContent = query;
document.getElementById('search-input').value = query;

// Function to get site options
function getSiteOptions() {
    fetch('http://127.0.0.1:8000/sites')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            siteOptions = data.sites;
            
            // Populate site filter checkboxes
            const siteOptionsContainer = document.getElementById('site-options');
            siteOptionsContainer.innerHTML = ''; // Clear existing options
            
            siteOptions.forEach(site => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'checkbox-option';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `site-${site.replace(/\s+/g, '-')}`;
                checkbox.value = site;
                checkbox.checked = true; // All sites checked by default
                checkbox.className = 'site-checkbox';
                
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = site;
                
                checkboxDiv.appendChild(checkbox);
                checkboxDiv.appendChild(label);
                siteOptionsContainer.appendChild(checkboxDiv);
                
                // Add event listener to update select-all checkbox when individual checkboxes change
                checkbox.addEventListener('change', updateSelectAllCheckbox);
            });
            
            // Set up select-all checkbox functionality
            const selectAllCheckbox = document.getElementById('select-all-sites');
            selectAllCheckbox.addEventListener('change', function() {
                const siteCheckboxes = document.querySelectorAll('.site-checkbox');
                siteCheckboxes.forEach(checkbox => {
                    checkbox.checked = selectAllCheckbox.checked;
                });
            });
            
            // Initialize dropdown toggle
            setupSiteFilterDropdown();
            
            // Update selected sites text
            updateSelectedSitesText();
        })
        .catch(error => {
            console.error("Error fetching site options:", error);
        });
}

// Function to set up dropdown toggle behavior
function setupSiteFilterDropdown() {
    const dropdownHeader = document.getElementById('site-filter-header');
    const dropdownMenu = document.getElementById('site-filter-menu');
    const dropdownContainer = dropdownHeader.parentElement;
    const applyButton = document.getElementById('apply-site-filter');
    
    // Toggle dropdown on header click
    dropdownHeader.addEventListener('click', function(e) {
        dropdownContainer.classList.toggle('open');
        dropdownMenu.classList.toggle('show');
        e.stopPropagation();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!dropdownContainer.contains(e.target)) {
            dropdownContainer.classList.remove('open');
            dropdownMenu.classList.remove('show');
        }
    });
    
    // Apply button click handler
    applyButton.addEventListener('click', function() {
        updateSelectedSitesText();
        dropdownContainer.classList.remove('open');
        dropdownMenu.classList.remove('show');
        
        // Apply filter if we already have search results
        if (allSneakers.length > 0) {
            applyCurrencyAndFilters();
            displayMoreSneakers();
        }else{
            getdata();
        }
    });
}

// Function to update the text showing selected sites
function updateSelectedSitesText() {
    const selectedSites = getSelectedSites();
    const selectedSitesText = document.getElementById('selected-sites-text');
    
    if (selectedSites.length === 0) {
        selectedSitesText.textContent = 'No sites selected';
    } else if (selectedSites.length === siteOptions.length) {
        selectedSitesText.textContent = 'All Sites';
    } else if (selectedSites.length <= 2) {
        selectedSitesText.textContent = selectedSites.join(', ');
    } else {
        selectedSitesText.textContent = `${selectedSites.length} sites selected`;
    }
}

// Function to update the select-all checkbox based on individual checkboxes
function updateSelectAllCheckbox() {
    const siteCheckboxes = document.querySelectorAll('.site-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-sites');
    
    const allChecked = Array.from(siteCheckboxes).every(checkbox => checkbox.checked);
    const noneChecked = Array.from(siteCheckboxes).every(checkbox => !checkbox.checked);
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
}

// Function to get selected sites
function getSelectedSites() {
    const siteCheckboxes = document.querySelectorAll('.site-checkbox:checked');
    return Array.from(siteCheckboxes).map(checkbox => checkbox.value);
}

// Update the applyCurrencyAndFilters function to filter by selected sites
function applyCurrencyAndFilters() {
    const currencyOption = document.getElementById('currency-option').value;
    const selectedSites = getSelectedSites();
    
    // Filter sneakers by selected sites
    filteredSneakers = JSON.parse(JSON.stringify(
        allSneakers.filter(sneaker => selectedSites.includes(sneaker.site))
    ));
    
    // Apply currency conversion if not using original currency
    if (currencyOption !== 'original') {
        filteredSneakers.forEach(sneaker => {
            sneaker.variants.forEach(variant => {
                // Convert prices based on their range (assuming < 2000 is USD, otherwise INR)
                const sourceCurrency = variant.price < 2000 ? 'usd' : 'inr';
                
                if (sourceCurrency !== currencyOption) {
                    // Convert to target currency
                    if (sourceCurrency === 'usd' && currencyOption === 'inr') {
                        variant.price = variant.price * exchangeRates.inr;
                        if (variant.full_price) {
                            variant.full_price = variant.full_price * exchangeRates.inr;
                        }
                    } else if (sourceCurrency === 'inr' && currencyOption === 'usd') {
                        variant.price = variant.price / exchangeRates.inr;
                        if (variant.full_price) {
                            variant.full_price = variant.full_price / exchangeRates.inr;
                        }
                    }
                }
            });
        });
    }
    
    // Reset display counter
    displayedCount = 0;
    document.getElementById('results').innerHTML = "";
    
    // Show no results message if no sites are selected
    if (filteredSneakers.length === 0) {
        let noresult = document.getElementById("no-results");
        noresult.innerHTML = `
            <div class="no-results">
                <h3>No sneakers found</h3>
                <p>No matching products in the selected sites. Try selecting more sites or changing your search.</p>
            </div>
        `;
        noresult.style.display = 'block';
        document.getElementById('view-more-button').style.display = 'none';
    } else {
        document.getElementById('no-results').style.display = 'none';
    }
}

// Function to get data from the API
function getdata() {
    // Show loading indicator
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('no-results').style.display = 'none';
    document.getElementById('results').innerHTML = '';
    document.getElementById('view-more-button').style.display = 'none';
    
    // Reset tracking variables
    allSneakers = [];
    filteredSneakers = [];
    displayedCount = 0;
    
    let query = document.getElementById("search-input").value;
    if (!query) {
        document.getElementById('loading').style.display = 'none';
        return; // If input is empty, do nothing
    }
    
    // Get filter and sort options
    const sortOption = document.getElementById('sort-option').value;
    const selectedSites = getSelectedSites();
    
    // Update the search query text
    document.getElementById('search-query-text').textContent = query;
    
    // If no sites are selected, show no results
    if (selectedSites.length === 0) {
        document.getElementById('loading').style.display = 'none';
        let noresult = document.getElementById("no-results");
        noresult.innerHTML = `
            <div class="no-results">
                <h3>No sites selected</h3>
                <p>Please select at least one site to search.</p>
            </div>
        `;
        noresult.style.display = 'block';
        return;
    }
    
    // Fetch all sneakers from the API
    fetch(`http://127.0.0.1:8000/sneakers?search=${encodeURIComponent(query)}&sort=${sortOption}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            document.getElementById('loading').style.display = 'none';
            
            let resultsDiv = document.getElementById("results");
            let noresult = document.getElementById("no-results");
            resultsDiv.innerHTML = ""; // Clear previous results
            
            // Filter sneakers by selected sites
            const filteredData = data.filter(sneaker => selectedSites.includes(sneaker.site));
            
            if (filteredData.length === 0) {
                noresult.innerHTML = `
                    <div class="no-results">
                        <h3>No sneakers found for "${query}" in the selected sites</h3>
                        <p>Try searching with different keywords or select more sites.</p>
                    </div>
                `;
                noresult.style.display = 'block';
                return;
            }
            
            // Store all sneakers data
            allSneakers = filteredData;
            
            // Apply client-side currency conversion if needed
            applyCurrencyAndFilters();
            
            // Display the first batch of items
            displayMoreSneakers();
        })
        .catch(error => {
            console.error("Error fetching sneakers:", error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error-message').style.display = 'block';
        });
}

function displayMoreSneakers() {
    let resultsDiv = document.getElementById("results");
    let viewMoreButton = document.getElementById("view-more-button");

    if (filteredSneakers.length === 0) {
        // No sneakers to display
        resultsDiv.innerHTML = ""; // Clear any existing results
        viewMoreButton.style.display = 'none';
        return; // Exit the function early
    }
    
    // Get the current filtered sneakers to display
    const sneakersToDisplay = filteredSneakers.length > 0 ? filteredSneakers : allSneakers;
    
    // Get the next batch of items
    const nextBatch = sneakersToDisplay.slice(displayedCount, displayedCount + itemsPerPage);
    
    // Update the displayedCount
    displayedCount += nextBatch.length;
    
    // Create a grid for the results
    resultsDiv.className = 'results-grid';
    
    // Add the new items to the results
    nextBatch.forEach(sneaker => {
        // Calculate discount percentage if full_price is available
        const discount = sneaker.full_price && sneaker.full_price > sneaker.price 
            ? Math.round((1 - sneaker.price / sneaker.full_price) * 100) 
            : 0;
        
        // Determine currency symbol based on the selected currency option
        const currencyOption = document.getElementById('currency-option').value;
        let defaultCurrencySymbol;
        
        if (currencyOption === 'original') {
            // Use the original currency symbol based on price range
            defaultCurrencySymbol = sneaker.variants[0].price < 2000 ? '$' : '₹';
        } else {
            // Use the selected currency symbol
            defaultCurrencySymbol = currencyOption === 'usd' ? '$' : '₹';
        }
        
        // Create card element
        const card = document.createElement('div');
        card.className = 'sneaker-card';
        
        card.innerHTML = `
            ${sneaker.site ? `<div class="vendor-badge">${sneaker.site}</div>` : ''}
            <a href="${sneaker.link}" target="_blank">
                <img src="${sneaker.main_image}" 
                     alt="${sneaker.title}" 
                     class="sneaker-image" 
                     onmouseover="this.src='${sneaker.hover_image}'" 
                     onmouseout="this.src='${sneaker.main_image}'">
            </a>
            <div class="sneaker-info">
                <a href="${sneaker.link}" target="_blank">
                    <h3 class="sneaker-title">${sneaker.title}</h3>
                </a>
                ${sneaker.brand ? `<div class="sneaker-brand">${sneaker.brand}</div>` : ''}
            
                <!-- Sizes -->
                <div class="size-options">
                    ${sneaker.variants.map((variant, index) => {
                        let currencySymbol = defaultCurrencySymbol;
                        return `
                            <div class="size-box" onclick="updatePrice(this, ${variant.price}, ${variant.full_price}, '${currencySymbol}')" data-index="${index}">
                                ${variant.size}
                            </div>
                        `;
                    }).join('')}
                </div>
            
                <!-- Price -->
                <div class="sneaker-price">
                    ${(() => {
                        let firstVariant = sneaker.variants[0];
                        let currencySymbol = defaultCurrencySymbol;
                        return `
                            <span class="sale-price" id="price-${sneaker.title.replace(/\s+/g, '-')}">${currencySymbol}${parseFloat(firstVariant.price).toLocaleString()}</span>
                            ${firstVariant.full_price ? 
                                `<span class="full-price" id="full-price-${sneaker.title.replace(/\s+/g, '-')}">${currencySymbol}${parseFloat(firstVariant.full_price).toLocaleString()}</span>` 
                                : ''}
                        `;
                    })()}
                    ${discount > 0 ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
                </div>
            </div>
        `;
        
        resultsDiv.appendChild(card);
    });
    
    // Show/hide "View More" button based on whether there are more items
    if (displayedCount < sneakersToDisplay.length) {
        viewMoreButton.style.display = 'inline-block';
    } else {
        viewMoreButton.style.display = 'none';
    }
}

function updatePrice(element, newPrice, fullPrice, currencySymbol) {
    let titleId = element.parentNode.nextElementSibling.querySelector(".sale-price").id;
    let fullPriceId = element.parentNode.nextElementSibling.querySelector(".full-price")?.id;

    document.getElementById(titleId).innerText = `${currencySymbol}${parseFloat(newPrice).toLocaleString()}`;
    if (fullPriceId && fullPrice) {
        document.getElementById(fullPriceId).innerText = `${currencySymbol}${parseFloat(fullPrice).toLocaleString()}`;
    }

    // Highlight selected size
    let sizeOptions = element.parentNode.querySelectorAll(".size-box");
    sizeOptions.forEach(box => box.classList.remove("selected-size"));
    element.classList.add("selected-size");
}

// Initialize the page
window.onload = function() {
    // Setup theme toggle
    setupThemeToggle();
    fetchExchangeRate();
    
    // Get site options for filtering
    getSiteOptions();
    
    // Wait until site options are loaded before searching
    let checkSitesLoaded = setInterval(() => {
        if (siteOptions.length > 0) {
            clearInterval(checkSitesLoaded);
            if (query) getdata();
        }
    }, 100);
    
    // Set up search functionality
    document.getElementById('search-button').addEventListener('click', function() {
        getdata();
    });
    
    // Enter key search
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            getdata();
        }
    });
    
    // Set up View More button functionality
    document.getElementById('view-more-button').addEventListener('click', function() {
        displayMoreSneakers();
    });
    
    // Set up Apply Filters button functionality
    document.getElementById('apply-filters').addEventListener('click', function() {
        if (allSneakers.length > 0) {
            applyCurrencyAndFilters();
            displayMoreSneakers();
        } else {
            getdata(); // If no data loaded yet, perform search
        }
    });
};

// Theme toggle functionality
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Set initial theme from localStorage or default to light
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

let scrollBtn = document.getElementById("scrollTopBtn");

window.onscroll = function() {
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
        scrollBtn.style.display = "block"; // Show button when scrolled
    } else {
        scrollBtn.style.display = "none"; // Hide button when at top
    }
};

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}