const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

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
                return status >= 200 && status < 400; // Accept redirects as success
            }
        });
        
        console.log('✅ Registration successful!');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        return true;
    } catch (error) {
        console.log('❌ Registration failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
        return false;
    }
}

async function testLogin() {
    console.log('\n🧪 Testing Login...');
    
    try {
        const formData = new FormData();
        formData.append('username', TEST_EMAIL);
        formData.append('password', TEST_PASSWORD);
        
        const response = await axios.post(`${BASE_URL}/login`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accept redirects as success
            }
        });
        
        console.log('✅ Login successful!');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        return true;
    } catch (error) {
        console.log('❌ Login failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
        return false;
    }
}

async function testGetRoutes() {
    console.log('\n🧪 Testing GET Routes...');
    
    try {
        // Test register page
        const registerResponse = await axios.get(`${BASE_URL}/register-user`);
        console.log('✅ Register page accessible:', registerResponse.status === 200);
        
        // Test login page
        const loginResponse = await axios.get(`${BASE_URL}/login`);
        console.log('✅ Login page accessible:', loginResponse.status === 200);
        
        return true;
    } catch (error) {
        console.log('❌ GET routes failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Authentication Tests...\n');
    
    const getRoutesTest = await testGetRoutes();
    const registrationTest = await testRegistration();
    const loginTest = await testLogin();
    
    console.log('\n📊 Test Results:');
    console.log('GET Routes:', getRoutesTest ? '✅ PASS' : '❌ FAIL');
    console.log('Registration:', registrationTest ? '✅ PASS' : '❌ FAIL');
    console.log('Login:', loginTest ? '✅ PASS' : '❌ FAIL');
    
    if (getRoutesTest && registrationTest && loginTest) {
        console.log('\n🎉 All tests passed! Authentication system is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the issues above.');
    }
}

// Run the tests
runTests().catch(console.error);
