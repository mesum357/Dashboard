document.addEventListener('DOMContentLoaded', function() {
    const imageForm = document.getElementById('profile-image-form');
    const imageUploadInput = document.getElementById('profile-image-upload');
    const profileImage = document.querySelector('.image-container img');
    const imageContainer = document.querySelector('.image-container');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const editProfileForm = document.getElementById('edit-profile-form');

    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
        });
    });



    imageUploadInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            imageForm.querySelector('.upload-button').click(); // Auto-submit when file is selected
        }
    });

    imageForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const file = imageUploadInput.files[0];

        if (!file) {
            alert('Please select an image file');
            return;
        }

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should not exceed 5MB');
            return;
        }

        const formData = new FormData(imageForm);
        imageContainer.classList.add('uploading'); // Add uploading state

        // Send image to server
        fetch('/upload-profile-image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                profileImage.src = data.imageUrl;
            } else {
                alert('Failed to upload image: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while uploading the image');
        })
        .finally(() => {
            imageContainer.classList.remove('uploading'); // Remove uploading state
        });
    });
});