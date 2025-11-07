// Pagination variables for item groups
let currentItemGroupsPage = 0;
let ITEMS_PER_PAGE = 8; // Will be calculated dynamically
let totalItemGroupsPages = 0;
let originalItemGroups = []; // Store original groups before filtering
let filteredItemGroups = []; // Store filtered groups based on search

// Pagination variables for group items
let currentGroupItemsPage = 0;
let GROUP_ITEMS_PER_PAGE = 20; // Will be calculated dynamically
let totalGroupItemsPages = 0;
let allGroupItems = []; // Store all items for the current group

// Calculate items per page based on screen size
function calculateItemsPerPage() {
    const itemGroupBtn = document.querySelector('.ha-item-group-btn');
    const groupItemBtn = document.querySelector('.ha-group-item-btn');
    
    // Calculate for item groups (horizontal layout)
    if (itemGroupsContainer) {
        const containerWidth = itemGroupsContainer.offsetWidth || window.innerWidth;
        const containerHeight = itemGroupsContainer.offsetHeight || 80; // Height of groups container
        const itemWidth = 150; // Width of each group button
        const itemHeight = 60; // Height of each group button
        const padding = 20; // Container padding
        const paginationWidth = 200; // Approximate pagination controls width
        const gap = 1; // Gap between buttons
        
        // Calculate items per row considering width
        const availableWidth = containerWidth - padding - paginationWidth;
        const itemsPerRow = Math.floor(availableWidth / (itemWidth + gap));
        
        // Calculate how many rows fit in the container height
        const availableHeight = containerHeight - 20; // Reserve for padding/margins
        const rows = Math.max(1, Math.floor(availableHeight / (itemHeight + gap)));
        
        // Total items = rows × columns
        const calculatedItems = itemsPerRow * rows;
        ITEMS_PER_PAGE = Math.max(4, Math.min(calculatedItems, 12)); // Min 4, Max 12
        
    }
    
    // Calculate for group items (grid layout)
    if (groupItemsContainer) {
        const containerWidth = groupItemsContainer.offsetWidth || window.innerWidth;
        const containerHeight = groupItemsContainer.offsetHeight || 400;
        const itemWidth = 150; // Width of each item button (updated to match CSS)
        const itemHeight = 60; // Min height of each item button (updated to match CSS)
        const padding = 20;
        const gap = 1; // Gap between items
        
        // Calculate items per row considering width and gaps
        const itemsPerRow = Math.floor((containerWidth - padding) / (itemWidth + gap));
        
        // Calculate number of rows considering height and gaps
        const availableHeight = containerHeight - 50; // Reserve 50px for pagination
        const rows = Math.floor(availableHeight / (itemHeight + gap));
        
        // Total items = rows × columns
        const calculatedItems = Math.max(1, itemsPerRow) * Math.max(1, rows);
        GROUP_ITEMS_PER_PAGE = Math.max(10, Math.min(calculatedItems, 100)); // Min 10, Max 100
        
    }
}

// Recalculate on window resize
window.addEventListener('resize', () => {
    const wasGroupsPage = currentItemGroupsPage;
    const wasItemsPage = currentGroupItemsPage;
    
    calculateItemsPerPage();
    
    // Recalculate total pages
    if (itemGroups.length > 0) {
        totalItemGroupsPages = Math.ceil(itemGroups.length / ITEMS_PER_PAGE);
        currentItemGroupsPage = Math.min(wasGroupsPage, totalItemGroupsPages - 1);
        displayItemGroupsWithPagination();
    }
    
    if (allGroupItems.length > 0 && currentItemGroup) {
        // Reload current page to adjust for new items per page
        loadItemsByGroup(currentItemGroup, 0);
    }
});

// Load item groups
function loadItemGroups(callback) {
    // console.log('Loading item groups...');
    frappe.call({
        method: "havano_pos_addson.api.get_item_groups",
        callback: function(response) {
            // console.log('Item groups response:', response);
            if (response.message) {
                originalItemGroups = response.message;
                itemGroups = [...originalItemGroups];
                filteredItemGroups = [...itemGroups];
                
                // Calculate items per page based on screen size
                setTimeout(() => {
                    calculateItemsPerPage();
                    totalItemGroupsPages = Math.ceil(itemGroups.length / ITEMS_PER_PAGE);
                    currentItemGroupsPage = 0; // Reset to first page
                    // console.log('Item groups loaded:', itemGroups.length, 'groups');
                    displayItemGroupsWithPagination();
                    
                    // Setup search input event listener
                    setupGroupSearchListener();
                }, 100);
                if (callback) callback();
            } else {
                console.error('No item groups in response');
                showToast('Failed to load item groups', 'error');
                if (callback) callback();
            }
        },
        error: function(error) {
            console.error('Error loading item groups:', error);
            showToast('Error loading item groups', 'error');
            if (callback) callback();
        }
    });
}

// Setup search input event listener
function setupGroupSearchListener() {
    const searchInput = document.getElementById('ha-group-search-input');
    if (searchInput) {
        // Add event listener for real-time search
        searchInput.addEventListener('input', function(e) {
            filterItemGroups(e.target.value);
        });
        
        // Also support Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterItemGroups(e.target.value);
            }
        });
    }
}

// Filter item groups based on search
function filterItemGroups(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        filteredItemGroups = [...originalItemGroups];
    } else {
        const search = searchTerm.toLowerCase().trim();
        filteredItemGroups = originalItemGroups.filter(group => {
            const groupName = (group.item_group_name || group.name || '').toLowerCase();
            return groupName.includes(search);
        });
    }
    
    itemGroups = [...filteredItemGroups];
    totalItemGroupsPages = Math.ceil(itemGroups.length / ITEMS_PER_PAGE);
    currentItemGroupsPage = 0; // Reset to first page
    displayItemGroupsWithPagination();
}

// Display item groups with pagination
function displayItemGroupsWithPagination() {
    if (!itemGroupsContainer) {
        console.error('Item groups container not found');
        return;
    }
    
    // console.log('Displaying item groups, total groups:', itemGroups.length);
    itemGroupsContainer.innerHTML = '';
    
    // Calculate current page items
    const startIndex = currentItemGroupsPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageGroups = itemGroups.slice(startIndex, endIndex);
    
    // console.log('Current page groups:', currentPageGroups.length);
    
    // Ensure container is visible
    if (itemGroupsContainer) {
        itemGroupsContainer.style.display = 'flex';
        itemGroupsContainer.style.visibility = 'visible';
        // console.log('Item groups container is visible');
    }
    
    // Create wrapper for pagination and groups (same row)
    const paginationAndGroupsWrapper = document.createElement('div');
    paginationAndGroupsWrapper.className = 'ha-pagination-and-groups-wrapper';
    
    // Create pagination controls container
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'ha-pagination-container';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'ha-pagination-btn ha-prev-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentItemGroupsPage === 0;
    prevBtn.addEventListener('click', () => {
        if (currentItemGroupsPage > 0) {
            currentItemGroupsPage--;
            displayItemGroupsWithPagination();
        }
    });
    
    // Add page numbers if there are more than 3 pages
    const pageNumbersContainer = document.createElement('div');
    pageNumbersContainer.className = 'ha-page-numbers';
    
    if (totalItemGroupsPages > 3) {
        const startPage = Math.max(0, currentItemGroupsPage - 1);
        const endPage = Math.min(totalItemGroupsPages - 1, currentItemGroupsPage + 1);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `ha-page-number-btn ${i === currentItemGroupsPage ? 'active' : ''}`;
            pageBtn.textContent = i + 1;
            pageBtn.addEventListener('click', () => {
                currentItemGroupsPage = i;
                displayItemGroupsWithPagination();
            });
            pageNumbersContainer.appendChild(pageBtn);
        }
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ha-pagination-btn ha-next-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentItemGroupsPage >= totalItemGroupsPages - 1;
    nextBtn.addEventListener('click', () => {
        if (currentItemGroupsPage < totalItemGroupsPages - 1) {
            currentItemGroupsPage++;
            displayItemGroupsWithPagination();
        }
    });
    
    // Add pagination controls
    paginationContainer.appendChild(prevBtn);
    if (totalItemGroupsPages > 3) {
        paginationContainer.appendChild(pageNumbersContainer);
    }
    paginationContainer.appendChild(nextBtn);
    
    // Add pagination to wrapper
    paginationAndGroupsWrapper.appendChild(paginationContainer);
    
    // Create wrapper for group buttons
    const groupsButtonsWrapper = document.createElement('div');
    groupsButtonsWrapper.className = 'ha-groups-buttons-wrapper';
    
    // Display current page groups
    currentPageGroups.forEach(group => {
        const groupBtn = document.createElement('button');
        groupBtn.className = 'ha-item-group-btn';
        groupBtn.textContent = group.item_group_name || group.name;
        groupBtn.dataset.groupName = group.name;
        
        groupBtn.addEventListener('click', () => {
            // Set active group
            document.querySelectorAll('.ha-item-group-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            groupBtn.classList.add('active');
            
            // Load items for this group
            currentItemGroup = group.name;
            loadItemsByGroup(group.name, 0);
        });
        
        groupsButtonsWrapper.appendChild(groupBtn);
    });
    
    // Add groups to wrapper
    paginationAndGroupsWrapper.appendChild(groupsButtonsWrapper);
    
    // Add the combined wrapper to container
    itemGroupsContainer.appendChild(paginationAndGroupsWrapper);
}

// Go to specific page
function goToItemGroupsPage(pageNumber) {
    if (pageNumber >= 0 && pageNumber < totalItemGroupsPages) {
        currentItemGroupsPage = pageNumber;
        displayItemGroupsWithPagination();
    }
}

// Add keyboard navigation for both item groups and group items
function addItemGroupsKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // Check if we're in item groups area
        if (itemGroupsContainer && itemGroupsContainer.offsetParent !== null) {
            // Handle item groups pagination
            if (e.key === 'ArrowLeft' && currentItemGroupsPage > 0) {
                e.preventDefault();
                currentItemGroupsPage--;
                displayItemGroupsWithPagination();
            } else if (e.key === 'ArrowRight' && currentItemGroupsPage < totalItemGroupsPages - 1) {
                e.preventDefault();
                currentItemGroupsPage++;
                displayItemGroupsWithPagination();
            }
        }
        
        // Check if we're in group items area and pagination is visible
        if (groupItemsContainer && groupItemsContainer.offsetParent !== null && totalGroupItemsPages > 1) {
            // Handle group items pagination
            if (e.key === 'ArrowUp' && currentGroupItemsPage > 0) {
                e.preventDefault();
                currentGroupItemsPage--;
                displayGroupItemsWithPagination();
            } else if (e.key === 'ArrowDown' && currentGroupItemsPage < totalGroupItemsPages - 1) {
                e.preventDefault();
                currentGroupItemsPage++;
                displayGroupItemsWithPagination();
            }
        }
    });
}

// Initialize keyboard navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    addItemGroupsKeyboardNavigation();
});

// Legacy function for backward compatibility
function displayItemGroups(groups) {
    displayItemGroupsWithPagination();
}

// Load items by group using API with pagination
function loadItemsByGroup(groupName, page = 0) {
    showLoading();
    currentGroupItemsPage = page;
    
    frappe.call({
        method: "havano_pos_addson.api.get_items_by_group",
        args: {
            item_group: groupName,
            page: page,
            page_size: GROUP_ITEMS_PER_PAGE
        },
        callback: function(response) {
            hideLoading();
            if (response.message && response.message.items) {
                allGroupItems = response.message.items;
                totalGroupItemsPages = response.message.total_pages;
                currentGroupItemsPage = response.message.page;
                displayGroupItemsWithPagination();
            } else if (response.message && response.message.error) {
                showToast('Error: ' + response.message.error, 'error');
            } else {
                showToast('Failed to load items for this group', 'error');
            }
        },
        error: function(error) {
            hideLoading();
            showToast('Error loading items for this group', 'error');
        }
    });
}

// Display items in the group with pagination
function displayGroupItemsWithPagination() {
    groupItemsContainer.innerHTML = '';
    
    if (allGroupItems.length === 0) {
        groupItemsContainer.innerHTML = '<div class="text-center" style="grid-column: 1 / -1; padding: 20px;">No items found in this group</div>';
        return;
    }
    
    // Only show pagination if there are multiple pages
    if (totalGroupItemsPages > 1) {
        // Create pagination controls container
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'ha-group-items-pagination-container';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'ha-group-pagination-btn ha-group-prev-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentGroupItemsPage === 0;
        prevBtn.addEventListener('click', () => {
            if (currentGroupItemsPage > 0) {
                loadItemsByGroup(currentItemGroup, currentGroupItemsPage - 1);
            }
        });
        
        // Add page numbers
        const pageNumbersContainer = document.createElement('div');
        pageNumbersContainer.className = 'ha-page-numbers';
        
        if (totalGroupItemsPages <= 5) {
            // Show all pages if 5 or fewer
            for (let i = 0; i < totalGroupItemsPages; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `ha-group-page-number-btn ${i === currentGroupItemsPage ? 'active' : ''}`;
                pageBtn.textContent = i + 1;
                pageBtn.addEventListener('click', () => {
                    loadItemsByGroup(currentItemGroup, i);
                });
                pageNumbersContainer.appendChild(pageBtn);
            }
        } else {
            // Show current page and neighbors if more than 5 pages
            const startPage = Math.max(0, currentGroupItemsPage - 1);
            const endPage = Math.min(totalGroupItemsPages - 1, currentGroupItemsPage + 1);
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `ha-group-page-number-btn ${i === currentGroupItemsPage ? 'active' : ''}`;
                pageBtn.textContent = i + 1;
                pageBtn.addEventListener('click', () => {
                    loadItemsByGroup(currentItemGroup, i);
                });
                pageNumbersContainer.appendChild(pageBtn);
            }
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'ha-group-pagination-btn ha-group-next-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentGroupItemsPage >= totalGroupItemsPages - 1;
        nextBtn.addEventListener('click', () => {
            if (currentGroupItemsPage < totalGroupItemsPages - 1) {
                loadItemsByGroup(currentItemGroup, currentGroupItemsPage + 1);
            }
        });
        
        // Add pagination controls
        paginationContainer.appendChild(prevBtn);
        paginationContainer.appendChild(pageNumbersContainer);
        paginationContainer.appendChild(nextBtn);
        groupItemsContainer.appendChild(paginationContainer);
    }
    
    // Display items (no slicing needed, items are already paginated from API)
    allGroupItems.forEach(item => {
        const itemBtn = document.createElement('div');
        itemBtn.className = 'ha-group-item-btn';
        itemBtn.innerHTML = `
            <span class="ha-item-code-small">${item.item_name}</span>
        `;
            
        itemBtn.addEventListener('click', () => {
            // Add this item to the items table
            const result = addItemToTable(item);
            
            // Only add new row if item was added to a new row (not just quantity increased)
            if (result === 'new_item_added') {
                addNewRow();
            }
        });
        
        groupItemsContainer.appendChild(itemBtn);
    });
}

// Go to specific page for group items
function goToGroupItemsPage(pageNumber) {
    if (pageNumber >= 0 && pageNumber < totalGroupItemsPages) {
        currentGroupItemsPage = pageNumber;
        displayGroupItemsWithPagination();
    }
}

// Legacy function for backward compatibility
function displayGroupItems(items) {
    allGroupItems = items;
    totalGroupItemsPages = Math.ceil(items.length / GROUP_ITEMS_PER_PAGE);
    currentGroupItemsPage = 0;
    displayGroupItemsWithPagination();
}
function addItemToTable(item) {
    const itemRate = parseFloat(item.valuation_rate) || 0;
    const itemDescription = item.description || '';
    const isGiftItem = itemDescription.toLowerCase().includes('gift');

    if (itemRate === 0 && !isGiftItem) {
        const itemName = item.item_name || item.name || 'Unknown Item';
        frappe.msgprint(`Item ${itemName} rate is empty. Please contact admin to add rate for this item.`);
        return false;
    }

    const itemCode = item.name;

    // Check if item already exists
    const existingRow = Array.from(itemsTableBody.querySelectorAll('tr')).find(row => {
        return row.querySelector('.item-code').value === itemCode;
    });

    if (existingRow) {
        const qtyField = existingRow.querySelector('.item-qty');
        const currentQty = parseFloat(qtyField.value) || 0;
        qtyField.value = currentQty + 1;
        updateItemAmount(qtyField);
        qtyField.focus();
        qtyField.select();

        return 'quantity_updated';
    }

    // Add new row if item doesn't exist
    addNewRow();
    const rows = itemsTableBody.querySelectorAll('tr');
    const targetRow = rows[rows.length - 1];

    // Make this row active
    rows.forEach(r => r.classList.remove('item-row-active'));
    targetRow.classList.add('item-row-active');

    removeEmptyRowsAbove(targetRow);

    targetRow.querySelector('.item-code').value = item.name;
    targetRow.querySelector('.item-name').value = item.item_name || item.name;
    targetRow.querySelector('.item-uom').value = item.stock_uom || 'Nos';
    targetRow.querySelector('.item-rate').value = itemRate.toFixed(2);

    updateItemAmount(targetRow.querySelector('.item-qty'));

    const qtyField = targetRow.querySelector('.item-qty');
    qtyField.focus();
    qtyField.select();

    return 'new_item_added';
}
