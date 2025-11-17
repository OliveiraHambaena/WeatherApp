document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const API_KEY = '9407acbb76e148968dc90119251711';
    const BASE_URL = 'http://api.weatherapi.com/v1';
    const DAILY_LIMIT = 1000;
    const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
    
    // DOM Elements
    const container = document.querySelector('.container');
    const searchInput = document.querySelector('.search-box input');
    const searchBtn = document.querySelector('.search-btn');
    const weatherIcon = document.querySelector('.weather-icon');
    const temperature = document.querySelector('.temperature');
    const description = document.querySelector('.description');
    const humidityValue = document.querySelector('.humidity-value');
    const windValue = document.querySelector('.wind-value');
    const weatherBox = document.querySelector('.weather-box');
    const weatherDetails = document.querySelector('.weather-details');
    const error404 = document.querySelector('.not-found');
    const suggestionsBox = document.querySelector('.suggestions-box');
    const apiCounter = document.querySelector('.api-counter');
    const cacheNotice = document.querySelector('.cache-notice');

    // Weather icon mapping (WeatherAPI.com condition codes)
    const weatherIconMap = {
        1000: 'clear.png',      // Sunny/Clear
        1003: 'cloud.png',      // Partly cloudy
        1006: 'cloud.png',      // Cloudy
        1009: 'cloud.png',      // Overcast
        1030: 'mist.png',       // Mist
        1063: 'rain.png',       // Patchy rain possible
        1066: 'snow.png',       // Patchy snow possible
        1069: 'snow.png',       // Patchy sleet possible
        1072: 'rain.png',       // Patchy freezing drizzle
        1087: 'rain.png',       // Thundery outbreaks possible
        1114: 'snow.png',       // Blowing snow
        1117: 'snow.png',       // Blizzard
        1135: 'mist.png',       // Fog
        1147: 'mist.png',       // Freezing fog
        1150: 'rain.png',       // Patchy light drizzle
        1153: 'rain.png',       // Light drizzle
        1168: 'rain.png',       // Freezing drizzle
        1171: 'rain.png',       // Heavy freezing drizzle
        1180: 'rain.png',       // Patchy light rain
        1183: 'rain.png',       // Light rain
        1186: 'rain.png',       // Moderate rain at times
        1189: 'rain.png',       // Moderate rain
        1192: 'rain.png',       // Heavy rain at times
        1195: 'rain.png',       // Heavy rain
        1198: 'rain.png',       // Light freezing rain
        1201: 'rain.png',       // Moderate or heavy freezing rain
        1204: 'snow.png',       // Light sleet
        1207: 'snow.png',       // Moderate or heavy sleet
        1210: 'snow.png',       // Patchy light snow
        1213: 'snow.png',       // Light snow
        1216: 'snow.png',       // Patchy moderate snow
        1219: 'snow.png',       // Moderate snow
        1222: 'snow.png',       // Patchy heavy snow
        1225: 'snow.png',       // Heavy snow
        1237: 'snow.png',       // Ice pellets
        1240: 'rain.png',       // Light rain shower
        1243: 'rain.png',       // Moderate or heavy rain shower
        1246: 'rain.png',       // Torrential rain shower
        1249: 'snow.png',       // Light sleet showers
        1252: 'snow.png',       // Moderate or heavy sleet showers
        1255: 'snow.png',       // Light snow showers
        1258: 'snow.png',       // Moderate or heavy snow showers
        1261: 'snow.png',       // Light showers of ice pellets
        1264: 'snow.png',       // Moderate or heavy showers of ice pellets
        1273: 'rain.png',       // Patchy light rain with thunder
        1276: 'rain.png',       // Moderate or heavy rain with thunder
        1279: 'snow.png',       // Patchy light snow with thunder
        1282: 'snow.png'        // Moderate or heavy snow with thunder
    };

    // State management
    let apiCallsToday = 0;
    const today = new Date().toDateString();

    // Initialize from localStorage
    function initState() {
        const savedState = localStorage.getItem('weatherAppState');
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.lastCallDate === today) {
                apiCallsToday = state.apiCalls || 0;
            }
        }
        updateCounter();
    }

    // Save state to localStorage
    function saveState() {
        localStorage.setItem('weatherAppState', JSON.stringify({
            apiCalls: apiCallsToday,
            lastCallDate: today
        }));
    }

    // Update API counter display
    function updateCounter() {
        apiCounter.textContent = `${DAILY_LIMIT - apiCallsToday}/${DAILY_LIMIT}`;
        if (DAILY_LIMIT - apiCallsToday < 10) {
            apiCounter.style.backgroundColor = 'rgba(255,50,50,0.8)';
        }
    }

    // Cache management
    const cache = {
        get: (key) => {
            const item = localStorage.getItem(`cache_${key}`);
            if (!item) return null;
            
            const { data, timestamp } = JSON.parse(item);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                return data;
            }
            return null;
        },
        set: (key, data) => {
            localStorage.setItem(`cache_${key}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        }
    };

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // API call with limit handling
    async function fetchWithLimit(url, cacheKey) {
        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
            cacheNotice.textContent = "Using cached data";
            return cached;
        }

        // Check API limit
        if (apiCallsToday >= DAILY_LIMIT) {
            throw new Error('API_LIMIT_REACHED');
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API_ERROR_${response.status}`);
            
            const data = await response.json();
            
            // Check for API error in response
            if (data.error) {
                throw new Error(`API_ERROR_${data.error.code}`);
            }
            
            apiCallsToday++;
            updateCounter();
            saveState();
            
            // Cache the response
            cache.set(cacheKey, data);
            cacheNotice.textContent = "";
            
            return data;
        } catch (error) {
            throw error;
        }
    }

    // Autocomplete suggestions
    async function fetchSuggestions(query) {
        try {
            const data = await fetchWithLimit(
                `${BASE_URL}/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`,
                `autocomplete_${query}`
            );
            showSuggestions(data);
        } catch (error) {
            console.error('Autocomplete error:', error);
            suggestionsBox.style.display = 'none';
        }
    }

    // Show suggestions dropdown
    function showSuggestions(cities) {
        suggestionsBox.innerHTML = '';
        if (!cities || cities.length === 0) {
            suggestionsBox.style.display = 'none';
            return;
        }

        cities.slice(0, 5).forEach(city => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion';
            suggestion.innerHTML = `
                <strong>${city.name}</strong>
                <span>${city.region}, ${city.country}</span>
            `;
            suggestion.addEventListener('click', async () => {
                searchInput.value = city.name;
                suggestionsBox.style.display = 'none';

                try {
                    await fetchWeather(city.name);
                } catch (error) {
                    handleWeatherError(error, city.name);
                }
            });
            suggestionsBox.appendChild(suggestion);
        });
        suggestionsBox.style.display = 'block';
    }

    // Fetch weather data
    async function fetchWeather(cityName) {
        try {
            setLoadingState(true);
            
            const weatherData = await fetchWithLimit(
                `${BASE_URL}/current.json?key=${API_KEY}&q=${encodeURIComponent(cityName)}&aqi=no`,
                `weather_${cityName}`
            );
            
            updateWeatherUI(weatherData, cityName);
        } catch (error) {
            handleWeatherError(error, cityName);
        } finally {
            setLoadingState(false);
        }
    }

    // Update UI with weather data
    function updateWeatherUI(data, cityName) {
        const weather = data.current;
        const location = data.location;
        
        // Set weather icon based on condition code
        const iconPath = weatherIconMap[weather.condition.code] || 'cloud.png';
        weatherIcon.src = `images/${iconPath}`;
        
        // Set temperature
        temperature.innerHTML = `${Math.round(weather.temp_c)}<span>°C</span>`;
        
        // Set description
        description.textContent = weather.condition.text;
        
        // Set humidity
        humidityValue.textContent = `${weather.humidity}%`;
        
        // Set wind speed
        windValue.textContent = `${Math.round(weather.wind_kph)} km/h`;
        
        // Show weather elements
        weatherBox.style.display = '';
        weatherDetails.style.display = '';
        error404.style.display = 'none';
        container.style.height = '590px';
        
        weatherBox.classList.add('fadeIn');
        weatherDetails.classList.add('fadeIn');
    }

    // Error handling
    function handleWeatherError(error, cityName) {
        let message = 'An error occurred';
        let showCached = true;
        
        if (error.message.includes('API_LIMIT_REACHED')) {
            message = 'Daily API limit reached (50 calls)';
            showCached = true;
        } 
        else if (error.message.includes('API_ERROR_2006')) {
            message = 'Invalid API key';
            showCached = false;
        }
        else if (error.message.includes('API_ERROR_1006') || error.message.includes('API_ERROR_400')) {
            message = 'Location not found';
            showCached = false;
        }
        else if (error.message.includes('API_ERROR_2007')) {
            message = 'API quota exceeded';
            showCached = true;
        }
        else if (error.message.includes('API_ERROR_2008')) {
            message = 'API key disabled';
            showCached = false;
        }
        else {
            message = 'Network error or invalid request';
            showCached = true;
        }
        
        // Try to show cached data if available
        if (showCached && cityName) {
            const cached = cache.get(`weather_${cityName}`);
            if (cached) {
                updateWeatherUI(cached, cityName);
                cacheNotice.textContent = "Showing cached data";
                return;
            }
        }
        
        error404.querySelector('p').textContent = message;
        error404.style.display = 'block';
        weatherBox.style.display = 'none';
        weatherDetails.style.display = 'none';
        container.style.height = '400px';
        error404.classList.add('fadeIn');
    }

    // Loading state
    function setLoadingState(isLoading) {
        if (isLoading) {
            searchBtn.innerHTML = '<img src="icons/spinner.svg" style="height:20px">';
            weatherBox.style.display = 'none';
            weatherDetails.style.display = 'none';
            error404.style.display = 'none';
        } else {
            searchBtn.innerHTML = '<img src="icons/magnifying-glass.svg" alt="Search">';
        }
    }

    // Event listeners
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.trim();
        if (query.length < 2) {
            suggestionsBox.style.display = 'none';
            return;
        }
        fetchSuggestions(query);
    }, 300));

    searchBtn.addEventListener('click', async function() {
        const city = searchInput.value.trim();
        if (!city) return;

        suggestionsBox.style.display = 'none';

        try {
            await fetchWeather(city);
        } catch (error) {
            handleWeatherError(error, city);
        }
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchBtn.click();
    });

    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            suggestionsBox.style.display = 'none';
        }
    });

    // Initialize
    initState();
});