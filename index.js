document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const API_KEY = 'fySh7TZvcdYHOGr94wydR4p1vVoAeA0w';
    const BASE_URL = 'https://dataservice.accuweather.com';
    const DAILY_LIMIT = 50;
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

    // Weather icon mapping
    const weatherIconMap = {
        1: 'clear.png', 2: 'clear.png',   // Sunny
        3: 'cloud.png', 4: 'cloud.png',   // Partly Cloudy
        5: 'cloud.png', 6: 'cloud.png',   // Mostly Cloudy
        7: 'cloud.png', 8: 'cloud.png',   // Cloudy
        11: 'mist.png', 32: 'mist.png',   // Fog
        12: 'rain.png', 13: 'rain.png',   // Showers
        14: 'rain.png', 18: 'rain.png',   // Rain
        15: 'rain.png', 16: 'rain.png',   // Thunderstorms
        22: 'snow.png', 23: 'snow.png',  // Snow
        29: 'snow.png'                   // Rain and Snow
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
                `${BASE_URL}/locations/v1/cities/autocomplete?apikey=${API_KEY}&q=${query}&language=en-us`,
                `autocomplete_${query}`
            );
            showSuggestions(data);
        } catch (error) {
            console.error('Autocomplete error:', error);
            suggestionsBox.style.display = 'none';
        }
    }

    // Show suggestions dropdown
    async function showSuggestions(cities) {
        suggestionsBox.innerHTML = '';
        if (!cities || cities.length === 0) return;

        cities.slice(0, 5).forEach(city => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion';
            suggestion.innerHTML = `
                <strong>${city.LocalizedName}</strong>
                <span>${city.AdministrativeArea.LocalizedName}, ${city.Country.LocalizedName}</span>
            `;
            suggestion.addEventListener('click', async () => {
                searchInput.value = city.LocalizedName;
                suggestionsBox.style.display = 'none';

                try {
                    const weatherData = await fetchWeather(city.Key);
                    updateWeatherUI(weatherData[0], city.LocalizedName);
                } catch (error) {
                    handleWeatherError(error, city.Key);
                }
            });
            suggestionsBox.appendChild(suggestion);
        });
        suggestionsBox.style.display = 'block';
    }

    // Fetch weather data
    async function fetchWeather(locationKey, cityName) {
        try {
            setLoadingState(true);
            
            const [weatherData] = await fetchWithLimit(
                `${BASE_URL}/currentconditions/v1/${locationKey}?apikey=${API_KEY}&language=en-us&details=true`,
                `weather_${locationKey}`
            );
            
            updateWeatherUI(weatherData, cityName);
        } catch (error) {
            handleWeatherError(error, locationKey);
        } finally {
            setLoadingState(false);
        }
    }

    // Update UI with weather data
    function updateWeatherUI(weather, cityName) {
        weatherIcon.src = `images/${weatherIconMap[weather.WeatherIcon] || 'cloud.png'}`;
        temperature.innerHTML = `${Math.round(weather.Temperature.Metric.Value)}<span>°C</span>`;
        description.textContent = weather.WeatherText;
        humidityValue.textContent = `${weather.RelativeHumidity || 'N/A'}%`;
        windValue.textContent = `${Math.round(weather.Wind.Speed.Metric.Value)} km/h`;
        
        weatherBox.style.display = '';
        weatherDetails.style.display = '';
        error404.style.display = 'none';
        container.style.height = '590px';
        
        weatherBox.classList.add('fadeIn');
        weatherDetails.classList.add('fadeIn');
    }

    // Error handling
    function handleWeatherError(error, locationKey) {
        let message = 'An error occurred';
        let showCached = true;
        
        if (error.message.includes('API_LIMIT_REACHED')) {
            message = 'Daily API limit reached (50 calls)';
            showCached = true;
        } 
        else if (error.message.includes('API_ERROR_401')) {
            message = 'Invalid API key';
            showCached = false;
        }
        else if (error.message.includes('API_ERROR_404')) {
            message = 'Location not found';
            showCached = false;
        }
        else {
            message = 'Network error';
            showCached = true;
        }
        
        // Try to show cached data if available
        if (showCached) {
            const cached = cache.get(`weather_${locationKey}`);
            if (cached) {
                updateWeatherUI(cached[0], searchInput.value);
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
            // First try to get location key
            const cities = await fetchWithLimit(
                `${BASE_URL}/locations/v1/cities/search?apikey=${API_KEY}&q=${city}&language=en-us`,
                `search_${city}`
            );

            if (cities && cities.length > 0) {
                const weatherData = await fetchWeather(cities[0].Key);
                updateWeatherUI(weatherData[0], cities[0].LocalizedName);
            } else {
                throw new Error('Location not found');
            }
        } catch (error) {
            handleWeatherError(error, '');
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