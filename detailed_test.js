const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'testuser@example.com';
const TEST_PASSWORD = 'testpass123';

async function testRegistration() {
    console.log('🧪 Testing Registration...');
    
    try {
        const formData = new FormData();
        formData.append('username', TEST_EMAIL);
        formData.append('password', TEST_PASSWORD);
        
        const response = await axios.post(`${BASE_URL}/register-user`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        console.log('✅ Registration successful!');
        console.log('Status:', response.status);
        return true;
    } catch (error) {
        console.log('❌ Registration failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data.substring(0, 200) + '...');
        } else {
            console.log('Error:', error.message);
        }
        return false;
    }
}

async function testLoginWithSession() {
    console.log('\n🧪 Testing Login with Session...');
    
    try {
        // Create a session
        const session = axios.create({
            withCredentials: true,
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        const formData = new FormData();
        formData.append('username', TEST_EMAIL);
        formData.append('password', TEST_PASSWORD);
        
        const response = await session.post(`${BASE_URL}/login`, formData, {
            headers: {
                ...formData.getHeaders(),
            }
        });
        
        console.log('✅ Login successful!');
        console.log('Status:', response.status);
        console.log('Headers:', Object.keys(response.headers));
        return true;
    } catch (error) {
        console.log('❌ Login failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response headers:', Object.keys(error.response.headers));
            if (error.response.status === 500) {
                console.log('Server error - checking if user exists in database...');
            }
        } else {
            console.log('Error:', error.message);
        }
        return false;
    }
}

async function testLoginWithWrongPassword() {
    console.log('\n🧪 Testing Login with Wrong Password...');
    
    try {
        const formData = new FormData();
        formData.append('username', TEST_EMAIL);
        formData.append('password', 'wrongpassword');
        
        const response = await axios.post(`${BASE_URL}/login`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        console.log('✅ Wrong password handled correctly!');
        console.log('Status:', response.status);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 302) {
            console.log('✅ Wrong password correctly redirected to login page');
            return true;
        } else {
            console.log('❌ Wrong password test failed:');
            console.log('Status:', error.response ? error.response.status : 'No response');
            return false;
        }
    }
}

async function testNonExistentUser() {
    console.log('\n🧪 Testing Login with Non-existent User...');
    
    try {
        const formData = new FormData();
        formData.append('username', 'nonexistent@example.com');
        formData.append('password', 'password123');
        
        const response = await axios.post(`${BASE_URL}/login`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        
        console.log('✅ Non-existent user handled correctly!');
        console.log('Status:', response.status);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 302) {
            console.log('✅ Non-existent user correctly redirected to login page');
            return true;
        } else {
            console.log('❌ Non-existent user test failed:');
            console.log('Status:', error.response ? error.response.status : 'No response');
            return false;
        }
    }
}

async function runDetailedTests() {
    console.log('🚀 Starting Detailed Authentication Tests...\n');
    
    const registrationTest = await testRegistration();
    const loginTest = await testLoginWithSession();
    const wrongPasswordTest = await testLoginWithWrongPassword();
    const nonExistentUserTest = await testNonExistentUser();
    
    console.log('\n📊 Detailed Test Results:');
    console.log('Registration:', registrationTest ? '✅ PASS' : '❌ FAIL');
    console.log('Login:', loginTest ? '✅ PASS' : '❌ FAIL');
    console.log('Wrong Password:', wrongPasswordTest ? '✅ PASS' : '❌ FAIL');
    console.log('Non-existent User:', nonExistentUserTest ? '✅ PASS' : '❌ FAIL');
    
    if (registrationTest && loginTest && wrongPasswordTest && nonExistentUserTest) {
        console.log('\n🎉 All detailed tests passed!');
    } else {
        console.log('\n⚠️  Some tests failed. Issues need to be addressed.');
    }
}

runDetailedTests().catch(console.error);
