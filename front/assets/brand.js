// Track current data and page count
let allSneakers = [];
let filteredSneakers = [];
let displayedCount = 0;
const itemsPerPage = 30;
let siteOptions = [];

// Currency conversion rates (approximate)
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

// Get the brand name from the current page
function getCurrentBrand() {
    // Default to jordan if we can't determine
    let brand = 'jordan';
    
    // Get from page URL if available
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('brand')) {
        brand = urlParams.get('brand');
    } else {
        // Try to extract from filename
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        if (filename.includes('.html')) {
            brand = filename.replace('.html', '');
        }
    }
    
    return brand;
}

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

// Update the page title and header based on brand
function updateBrandPageElements() {
    const brand = getCurrentBrand();
    const brandCapitalized = brand.charAt(0).toUpperCase() + brand.slice(1);
    
    // Update page title
    document.title = `SneakerEye - ${brandCapitalized} Collection`;
    
    // Update header
    const headerTitle = document.querySelector('.search-title');
    if (headerTitle) {
        headerTitle.innerHTML = `${brandCapitalized} <span class="search-query">Collection</span>`;
    }
    
    // Update loading message
    const loadingMessage = document.getElementById('loading');
    if (loadingMessage) {
        loadingMessage.textContent = `Loading ${brandCapitalized} sneakers...`;
    }
}

// Function to get brand data from the API
function getBrandData() {
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
    
    // Get filter and sort options
    const sortOption = document.getElementById('sort-option').value;
    const selectedSites = getSelectedSites();
    
    // Get the brand from the current file path or URL
    const brandName = getCurrentBrand();
    
    // If no sites are selected, show no results
    if (selectedSites.length === 0) {
        document.getElementById('loading').style.display = 'none';
        let noresult = document.getElementById("no-results");
        noresult.innerHTML = `
            <div class="no-results">
                <h3>No sites selected</h3>
                <p>Please select at least one site to view ${brandName} sneakers.</p>
            </div>
        `;
        noresult.style.display = 'block';
        return;
    }
    
    // Fetch brand sneakers from the API
    fetch(`http://127.0.0.1:8000/brand?brand=${encodeURIComponent(brandName)}`)
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
                        <h3>No ${brandName} sneakers found in the selected sites</h3>
                        <p>Try selecting more sites or check back later for new arrivals.</p>
                    </div>
                `;
                noresult.style.display = 'block';
                return;
            }
            
            // Store all sneakers data
            allSneakers = filteredData;
            
            // Apply client-side sorting
            applySorting();
            
            // Apply client-side currency conversion and filtering
            applyCurrencyAndFilters();
            
            // Display the first batch of items
            displayMoreSneakers();
        })
        .catch(error => {
            console.error(`Error fetching ${brandName} sneakers:`, error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error-message').style.display = 'block';
        });
}

// Function to apply sorting to the sneakers
function applySorting() {
    const sortOption = document.getElementById('sort-option').value;
    
    if (sortOption === "price-low-high") {
        // Sort by the lowest price variant
        allSneakers.sort((a, b) => {
            const aMinPrice = Math.min(...a.variants.map(v => v.price || Infinity));
            const bMinPrice = Math.min(...b.variants.map(v => v.price || Infinity));
            return aMinPrice - bMinPrice;
        });
    } else if (sortOption === "price-high-low") {
        // Sort by the highest price variant
        allSneakers.sort((a, b) => {
            const aMaxPrice = Math.max(...a.variants.map(v => v.price || 0));
            const bMaxPrice = Math.max(...b.variants.map(v => v.price || 0));
            return bMaxPrice - aMaxPrice;
        });
    } else if (sortOption === "discount") {
        // Sort by the highest discount percentage
        allSneakers.sort((a, b) => {
            const getMaxDiscount = (sneaker) => {
                let discounts = [];
                for (let v of sneaker.variants) {
                    if (v.full_price && v.price) {
                        const discount = (1 - v.price / v.full_price) * 100;
                        discounts.push(discount);
                    }
                }
                return discounts.length > 0 ? Math.max(...discounts) : 0;
            };
            
            return getMaxDiscount(b) - getMaxDiscount(a);
        });
    } else if (sortOption === "newest") {
        // Sort by created_at timestamp if available
        allSneakers.sort((a, b) => {
            const aDate = a.created_at ? new Date(a.created_at) : new Date(0);
            const bDate = b.created_at ? new Date(b.created_at) : new Date(0);
            return bDate - aDate;
        });
    }
}

// Apply filters and currency conversion to the data
function applyCurrencyAndFilters() {
    const currencyOption = document.getElementById('currency-option').value;
    const selectedSites = getSelectedSites();
    
    // Filter sneakers by selected sites
    filteredSneakers = allSneakers.filter(sneaker => selectedSites.includes(sneaker.site));
    
    // Apply currency conversion if not using original currency
    if (currencyOption !== 'original') {
        filteredSneakers.forEach(sneaker => {
            sneaker.variants.forEach(variant => {
                // Convert prices based on their range (assuming < 1000 is USD, otherwise INR)
                const sourceCurrency = variant.price < 1000 ? 'usd' : 'inr';
                
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
                <p>No matching products in the selected sites. Try selecting more sites.</p>
            </div>
        `;
        noresult.style.display = 'block';
        document.getElementById('view-more-button').style.display = 'none';
    } else {
        document.getElementById('no-results').style.display = 'none';
    }
}

function displayMoreSneakers() {
    let resultsDiv = document.getElementById("results");
    let viewMoreButton = document.getElementById("view-more-button");
    
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
        let firstVariant = sneaker.variants[0] || {};
        const discount = firstVariant.full_price && firstVariant.price 
            ? Math.round((1 - firstVariant.price / firstVariant.full_price) * 100) 
            : 0;
        
        // Determine currency symbol based on the selected currency option
        const currencyOption = document.getElementById('currency-option').value;
        let defaultCurrencySymbol;
        
        if (currencyOption === 'original') {
            // Use the original currency symbol based on price range
            defaultCurrencySymbol = firstVariant.price < 1000 ? '$' : '₹';
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
                     onmouseover="this.src='${sneaker.hover_image || sneaker.main_image}'" 
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
                            <div class="size-box" onclick="updatePrice(this, ${variant.price}, ${variant.full_price || 'null'}, '${currencySymbol}')" data-index="${index}">
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
    
    // Update brand page elements
    updateBrandPageElements();
    
    // Get site options for filtering
    getSiteOptions();
    
    // Wait until site options are loaded before loading brand data
    let checkSitesLoaded = setInterval(() => {
        if (siteOptions.length > 0) {
            clearInterval(checkSitesLoaded);
            getBrandData();
        }
    }, 100);
    
    // Set up View More button functionality
    document.getElementById('view-more-button').addEventListener('click', function() {
        displayMoreSneakers();
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