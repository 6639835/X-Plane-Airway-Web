// Handle file uploads directly to Vercel Blob
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
        // Get file objects
        const csvFile = document.getElementById('csv_file').files[0];
        const earthFix = document.getElementById('earth_fix').files[0];
        const earthNav = document.getElementById('earth_nav').files[0];
        
        if (!csvFile || !earthFix || !earthNav) {
            showError('All three files are required');
            resetButton();
            return;
        }
        
        // Step 1: Get upload URLs
        const urlResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                csv_file_name: csvFile.name,
                earth_fix_name: earthFix.name,
                earth_nav_name: earthNav.name
            })
        });
        
        if (!urlResponse.ok) {
            const errorData = await urlResponse.json();
            throw new Error(errorData.error || 'Failed to get upload URLs');
        }
        
        const urlData = await urlResponse.json();
        
        // Step 2: Upload files directly to Blob Storage
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading files...';
        
        const uploadPromises = [
            uploadFileToBlobStorage(csvFile, urlData.csv_file.url),
            uploadFileToBlobStorage(earthFix, urlData.earth_fix.url),
            uploadFileToBlobStorage(earthNav, urlData.earth_nav.url)
        ];
        
        await Promise.all(uploadPromises);
        
        // Step 3: Process the uploaded files
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        const processResponse = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                csv_file: {
                    pathname: urlData.csv_file.pathname,
                    filename: csvFile.name
                },
                earth_fix: {
                    pathname: urlData.earth_fix.pathname,
                    filename: earthFix.name
                },
                earth_nav: {
                    pathname: urlData.earth_nav.pathname,
                    filename: earthNav.name
                }
            })
        });
        
        if (!processResponse.ok) {
            const errorData = await processResponse.json();
            throw new Error(errorData.error || 'Failed to process files');
        }
        
        const processData = await processResponse.json();
        
        // Redirect to success page or show result
        window.location.href = `/success?lines=${processData.lines_written}&skipped=${processData.skipped_rows}&url=${encodeURIComponent(processData.download_url)}&filename=${encodeURIComponent(processData.filename)}`;
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred during processing');
        resetButton();
    }
    
    function resetButton() {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

async function uploadFileToBlobStorage(file, url) {
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
    });
    
    if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}`);
    }
    
    return response;
}

function showError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'alert alert-error';
    errorContainer.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
    `;
    
    const form = document.querySelector('form');
    form.insertBefore(errorContainer, form.firstChild);
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorContainer.remove();
    }, 5000);
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}); 