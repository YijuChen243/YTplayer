// app.js
// Main application logic and YouTube player controller

import * as fb from './firebase-config.js';

// Application State
let state = {
  user: null,
  songs: [],
  activeSongIndex: -1,
  player: null,
  isPlayerReady: false,
  progressInterval: null,
  authMode: 'login' // 'login' or 'signup'
};

// UI Elements mapping
const elements = {
  loader: document.getElementById('app-loader'),
  sidebar: document.querySelector('.sidebar'),
  userProfileSection: document.getElementById('user-profile-section'),
  userDisplayName: document.getElementById('user-display-name'),
  userAvatar: document.getElementById('user-avatar'),
  btnLogout: document.getElementById('btn-logout'),
  
  viewUnconfigured: document.getElementById('view-unconfigured'),
  viewLoggedOut: document.getElementById('view-logged-out'),
  viewDashboard: document.getElementById('view-dashboard'),
  
  btnOpenSetup: document.getElementById('btn-open-setup'),
  btnQuickConfig: document.getElementById('btn-quick-config'),
  navSetupTrigger: document.getElementById('nav-setup-trigger'),
  modalSetup: document.getElementById('modal-setup'),
  btnCloseSetupModal: document.getElementById('btn-close-setup-modal'),
  btnCancelSetup: document.getElementById('btn-cancel-setup'),
  firebaseConfigForm: document.getElementById('firebase-config-form'),
  configJsonInput: document.getElementById('config-json'),
  
  tabLogin: document.getElementById('tab-login'),
  tabSignup: document.getElementById('tab-signup'),
  authForm: document.getElementById('auth-form'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  btnAuthSubmit: document.getElementById('btn-auth-submit'),
  
  dashboardWelcome: document.getElementById('dashboard-welcome'),
  songsCount: document.getElementById('songs-count'),
  songsListTarget: document.getElementById('songs-list-target'),
  songsEmptyState: document.getElementById('songs-empty-state'),
  addSongForm: document.getElementById('add-song-form'),
  songUrlInput: document.getElementById('song-url-input'),
  
  playerPlaceholder: document.getElementById('player-placeholder'),
  nowPlayingTitle: document.getElementById('now-playing-title'),
  nowPlayingSubtitle: document.getElementById('now-playing-subtitle'),
  
  ctrlPlay: document.getElementById('ctrl-play'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  ctrlPrev: document.getElementById('ctrl-prev'),
  ctrlNext: document.getElementById('ctrl-next'),
  ctrlMute: document.getElementById('ctrl-mute'),
  volHighIcon: document.getElementById('vol-high'),
  volMuteIcon: document.getElementById('vol-mute'),
  volumeSlider: document.getElementById('volume-slider'),
  
  seekContainer: document.getElementById('seek-container'),
  seekProgress: document.getElementById('seek-progress'),
  timeCurrent: document.getElementById('time-current'),
  timeTotal: document.getElementById('time-total'),
  
  toastContainer: document.getElementById('toast-container')
};

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  
  // Try initializing Firebase
  try {
    const isConfigAvailable = await fb.initFirebase();
    if (!isConfigAvailable) {
      // Firebase not configured yet
      showView('unconfigured');
      hideLoader();
      return;
    }
    
    // Load YouTube Player API Script
    loadYoutubeAPI();
    
    // Listen for Auth changes
    fb.onAuthChanged(async (currentUser) => {
      if (currentUser) {
        state.user = currentUser;
        
        // Update user UI
        const emailPrefix = currentUser.email.split('@')[0];
        elements.userDisplayName.textContent = emailPrefix;
        elements.userAvatar.textContent = emailPrefix.substring(0, 2).toUpperCase();
        elements.userProfileSection.classList.remove('hidden');
        
        // Greet user based on local time
        const hour = new Date().getHours();
        let greeting = '你好';
        if (hour < 5) greeting = '半夜好';
        else if (hour < 11) greeting = '早上好';
        else if (hour < 14) greeting = '中午好';
        else if (hour < 18) greeting = '下午好';
        else greeting = '晚上好';
        elements.dashboardWelcome.textContent = `${greeting}，${emailPrefix}`;
        
        // Load User Songs
        await loadUserSongs();
        showView('dashboard');
      } else {
        // Logged out state
        state.user = null;
        state.songs = [];
        state.activeSongIndex = -1;
        elements.userProfileSection.classList.add('hidden');
        resetPlayerUI();
        showView('logged-out');
      }
      hideLoader();
    });
    
  } catch (error) {
    console.error('Initialization failed:', error);
    showToast('連線失敗，請檢查您的 Firebase 設定是否有誤。', 'error');
    showView('unconfigured');
    hideLoader();
  }
});

// --- YOUTUBE PLAYER API ---

function loadYoutubeAPI() {
  if (window.YT) return; // Already loaded
  
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Global Callback required by YT API
window.onYouTubeIframeAPIReady = () => {
  state.player = new YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    videoId: '', // start empty
    playerVars: {
      playsinline: 1,
      controls: 0, // Disable default player controls
      disablekb: 1, // Disable keyboard controls inside player
      rel: 0, // Don't show related videos at the end
      modestbranding: 1, // Hide YT logo
      iv_load_policy: 3 // Don't show annotations
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
};

function onPlayerReady(event) {
  state.isPlayerReady = true;
  // Sync initial volume
  state.player.setVolume(elements.volumeSlider.value);
}

function onPlayerStateChange(event) {
  // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
  if (event.data === YT.PlayerState.PLAYING) {
    showPauseIcon();
    elements.playerPlaceholder.classList.add('hidden');
    startProgressTracker();
  } else if (event.data === YT.PlayerState.PAUSED) {
    showPlayIcon();
    stopProgressTracker();
  } else if (event.data === YT.PlayerState.ENDED) {
    stopProgressTracker();
    playNextSong(); // Auto play next track!
  } else if (event.data === YT.PlayerState.BUFFERING) {
    // Show loading in play button if wanted
  }
}

function onPlayerError(event) {
  console.error('YouTube Player Error:', event.data);
  
  // Ignore errors triggered by initial loading of empty player
  if (state.activeSongIndex === -1) {
    console.warn('Player error code cued on initialization (ignored):', event.data);
    return;
  }
  
  let errMsg = '播放時發生錯誤。';
  if (event.data === 2) errMsg = '不正確的影片識別碼（Video ID）。';
  else if (event.data === 5) errMsg = '播放器不支援此 HTML5 播放。';
  else if (event.data === 100) errMsg = '此影片已被移除或設定為私密。';
  else if (event.data === 101 || event.data === 150) errMsg = '此影片不允許在嵌入式播放器中播放。';
  
  showToast(errMsg, 'error');
  playNextSong(); // Skip broken video
}

// --- SONG / PLAYLIST MANAGEMENT ---

async function loadUserSongs() {
  if (!state.user) return;
  
  try {
    const songs = await fb.fetchUserSongs(state.user.uid);
    state.songs = songs;
    renderSongsList();
  } catch (error) {
    console.error('Failed to load songs:', error);
    showToast('讀取歌單失敗，請確認 Firebase Rules 規則設定。', 'error');
  }
}

function renderSongsList() {
  elements.songsCount.textContent = state.songs.length;
  
  // Clear lists
  const currentItems = elements.songsListTarget.querySelectorAll('.song-item');
  currentItems.forEach(item => item.remove());
  
  if (state.songs.length === 0) {
    elements.songsEmptyState.classList.remove('hidden');
    return;
  }
  
  elements.songsEmptyState.classList.add('hidden');
  
  state.songs.forEach((song, index) => {
    const songItem = document.createElement('div');
    songItem.className = `song-item ${index === state.activeSongIndex ? 'active' : ''}`;
    songItem.dataset.index = index;
    
    songItem.innerHTML = `
      <div class="song-thumb" style="background-image: url('${song.thumbnail}')">
        <div class="song-thumb-overlay">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div class="song-info">
        <div class="song-title" title="${song.title}">${song.title}</div>
        <div class="song-duration">YouTube 歌曲</div>
      </div>
      <div class="song-actions">
        <button class="song-action-btn delete-song-btn" data-id="${song.id}" title="從歌單刪除">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    
    // Play on click (except when clicking actions)
    songItem.addEventListener('click', (e) => {
      if (e.target.closest('.song-actions') || e.target.closest('.delete-song-btn')) {
        return;
      }
      playSong(index);
    });
    
    // Delete action
    const deleteBtn = songItem.querySelector('.delete-song-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const songId = deleteBtn.dataset.id;
      await deleteSong(songId, index);
    });
    
    elements.songsListTarget.appendChild(songItem);
  });
}

function playSong(index) {
  if (index < 0 || index >= state.songs.length) return;
  
  state.activeSongIndex = index;
  const song = state.songs[index];
  
  // Highlight active item
  const items = elements.songsListTarget.querySelectorAll('.song-item');
  items.forEach((item, idx) => {
    if (idx === index) item.classList.add('active');
    else item.classList.remove('active');
  });
  
  elements.nowPlayingTitle.textContent = song.title;
  elements.nowPlayingSubtitle.textContent = '現在播放';
  
  if (state.isPlayerReady) {
    elements.playerPlaceholder.classList.add('hidden');
    state.player.loadVideoById(song.videoId);
    showPauseIcon();
  } else {
    showToast('播放器正在啟動中，請稍候...', 'info');
  }
}

function playNextSong() {
  if (state.songs.length === 0) return;
  let nextIndex = state.activeSongIndex + 1;
  if (nextIndex >= state.songs.length) {
    nextIndex = 0; // Loop back
  }
  playSong(nextIndex);
}

function playPrevSong() {
  if (state.songs.length === 0) return;
  let prevIndex = state.activeSongIndex - 1;
  if (prevIndex < 0) {
    prevIndex = state.songs.length - 1; // Loop to end
  }
  playSong(prevIndex);
}

async function deleteSong(songId, index) {
  if (!confirm('確定要從歌單中刪除這首歌曲嗎？')) return;
  
  try {
    showLoaderText('刪除歌曲中...');
    await fb.deleteUserSong(state.user.uid, songId);
    
    // Adjust active index
    if (state.activeSongIndex === index) {
      // Stopped playing active song
      if (state.player) state.player.stopVideo();
      resetPlayerUI();
      state.activeSongIndex = -1;
    } else if (state.activeSongIndex > index) {
      state.activeSongIndex--;
    }
    
    state.songs.splice(index, 1);
    renderSongsList();
    showToast('已從歌單移除。', 'success');
  } catch (error) {
    console.error('Delete song failed:', error);
    showToast('刪除失敗。', 'error');
  } finally {
    hideLoader();
  }
}

// Extract Youtube Video ID from standard inputs
function extractVideoId(url) {
  if (!url) return null;
  url = url.trim();
  
  // A cleaner, more robust YouTube ID parser regex (handles watch, embed, shorts, share links, etc.)
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[1] && match[1].trim().length === 11) {
    return match[1].trim();
  }
  
  // Try 11 char exact match
  if (url.length === 11) {
    return url;
  }
  return null;
}

// Fetch YouTube video metadata via CORS-friendly oEmbed JSON wrapper
async function fetchVideoMetadata(videoId) {
  try {
    const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.title) {
        return {
          title: data.title,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        };
      }
    }
  } catch (e) {
    console.warn('oEmbed fetch error, fallback to default naming', e);
  }
  return {
    title: `YouTube 影片 (${videoId})`,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  };
}

// --- UTILITIES / RENDERING CONTROLS ---

function startProgressTracker() {
  stopProgressTracker();
  state.progressInterval = setInterval(() => {
    if (state.isPlayerReady && state.player && typeof state.player.getCurrentTime === 'function') {
      const current = state.player.getCurrentTime();
      const duration = state.player.getDuration() || 0;
      
      elements.timeCurrent.textContent = formatTime(current);
      elements.timeTotal.textContent = formatTime(duration);
      
      if (duration > 0) {
        const percent = (current / duration) * 100;
        elements.seekProgress.style.width = `${percent}%`;
      }
    }
  }, 500);
}

function stopProgressTracker() {
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
    state.progressInterval = null;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function resetPlayerUI() {
  elements.playerPlaceholder.classList.remove('hidden');
  elements.nowPlayingTitle.textContent = '等待播放歌曲...';
  elements.nowPlayingSubtitle.textContent = 'AeroPlay Player';
  elements.seekProgress.style.width = '0%';
  elements.timeCurrent.textContent = '0:00';
  elements.timeTotal.textContent = '0:00';
  showPlayIcon();
}

function showPlayIcon() {
  elements.playIcon.classList.remove('hidden');
  elements.pauseIcon.classList.add('hidden');
}

function showPauseIcon() {
  elements.playIcon.classList.add('hidden');
  elements.pauseIcon.classList.remove('hidden');
}

function showView(viewName) {
  elements.viewUnconfigured.classList.add('hidden');
  elements.viewLoggedOut.classList.add('hidden');
  elements.viewDashboard.classList.add('hidden');
  
  if (viewName === 'unconfigured') {
    elements.viewUnconfigured.classList.remove('hidden');
  } else if (viewName === 'logged-out') {
    elements.viewLoggedOut.classList.remove('hidden');
  } else if (viewName === 'dashboard') {
    elements.viewDashboard.classList.remove('hidden');
  }
}

function showLoaderText(text) {
  elements.loader.querySelector('.loader-text').textContent = text;
  elements.loader.style.opacity = '1';
  elements.loader.classList.remove('hidden');
}

function hideLoader() {
  elements.loader.style.opacity = '0';
  setTimeout(() => {
    elements.loader.classList.add('hidden');
  }, 300);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-message">${message}</span>`;
  
  elements.toastContainer.appendChild(toast);
  
  // animate show
  setTimeout(() => {
    toast.classList.add('show');
  }, 50);
  
  // animate hide and remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- EVENT HANDLERS ---

function setupEventListeners() {
  // --- Firebase Config Form Setup ---
  const openSetup = () => {
    const config = fb.getStoredConfig();
    if (config) {
      elements.configJsonInput.value = JSON.stringify(config, null, 2);
    } else {
      elements.configJsonInput.value = '';
    }
    elements.modalSetup.classList.add('active');
  };
  
  elements.btnOpenSetup.addEventListener('click', openSetup);
  elements.btnQuickConfig.addEventListener('click', openSetup);
  elements.navSetupTrigger.addEventListener('click', openSetup);
  
  const closeSetup = () => {
    elements.modalSetup.classList.remove('active');
  };
  
  elements.btnCloseSetupModal.addEventListener('click', closeSetup);
  elements.btnCancelSetup.addEventListener('click', closeSetup);
  
  elements.firebaseConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const configStr = elements.configJsonInput.value.trim();
      let config = null;
      
      // Try parsing as standard JSON first
      try {
        config = JSON.parse(configStr);
      } catch (jsonErr) {
        // Fallback: Parse using regex to extract properties (handles JS Object paste)
        config = {};
        const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
        keys.forEach(key => {
          const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`);
          const match = configStr.match(regex);
          if (match) {
            config[key] = match[1];
          }
        });
      }
      
      if (!config || !config.apiKey || !config.projectId) {
        throw new Error('無效的設定！必須包含 apiKey 和 projectId。');
      }
      
      fb.saveConfig(config);
      showToast('設定已儲存！網頁將在幾秒後重新載入。', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      showToast('無效的設定格式！請貼上完整的 Firebase Config。', 'error');
    }
  });

  // --- Auth Controls ---
  elements.tabLogin.addEventListener('click', () => {
    state.authMode = 'login';
    elements.tabLogin.classList.add('active');
    elements.tabSignup.classList.remove('active');
    elements.btnAuthSubmit.textContent = '登入';
  });
  
  elements.tabSignup.addEventListener('click', () => {
    state.authMode = 'signup';
    elements.tabSignup.classList.add('active');
    elements.tabLogin.classList.remove('active');
    elements.btnAuthSubmit.textContent = '註冊並登入';
  });
  
  elements.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;
    
    if (password.length < 6) {
      showToast('密碼長度必須至少 6 位元。', 'error');
      return;
    }
    
    try {
      showLoaderText(state.authMode === 'login' ? '登入中...' : '註冊帳號中...');
      if (state.authMode === 'login') {
        await fb.signInUser(email, password);
        showToast('登入成功！', 'success');
      } else {
        await fb.signUpUser(email, password);
        showToast('註冊成功！已經為您建立音樂雲端空間。', 'success');
      }
      // Reset form
      elements.authEmail.value = '';
      elements.authPassword.value = '';
    } catch (error) {
      console.error('Authentication action failed:', error);
      let errMsg = '驗證失敗，請檢查電子郵件或密碼。';
      if (error.code === 'auth/email-already-in-use') errMsg = '此信箱已被註冊！';
      else if (error.code === 'auth/invalid-email') errMsg = '電子郵件格式不正確。';
      else if (error.code === 'auth/weak-password') errMsg = '密碼強度不足。';
      else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') errMsg = '信箱或密碼輸入錯誤。';
      showToast(errMsg, 'error');
    } finally {
      hideLoader();
    }
  });
  
  elements.btnLogout.addEventListener('click', async () => {
    try {
      showLoaderText('正在登出...');
      await fb.signOutUser();
      showToast('已安全登出。', 'success');
    } catch (error) {
      showToast('登出失敗。', 'error');
    } finally {
      hideLoader();
    }
  });

  // --- Add Song Control ---
  elements.addSongForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) return;
    
    const inputVal = elements.songUrlInput.value.trim();
    const videoId = extractVideoId(inputVal);
    
    if (!videoId) {
      showToast('無效的 YouTube 網址或影片 ID！', 'error');
      return;
    }
    
    // Check if song already exists in user's library
    const exists = state.songs.some(song => song.videoId === videoId);
    if (exists) {
      showToast('此歌曲已存在於您的歌單中。', 'info');
      elements.songUrlInput.value = '';
      return;
    }
    
    try {
      showLoaderText('擷取影片資訊與儲存中...');
      const metadata = await fetchVideoMetadata(videoId);
      
      const savedSong = await fb.saveSong(state.user.uid, {
        videoId: videoId,
        title: metadata.title,
        thumbnail: metadata.thumbnail
      });
      
      // Update state & list
      state.songs.unshift(savedSong);
      renderSongsList();
      elements.songUrlInput.value = '';
      
      showToast('成功新增至歌單！', 'success');
    } catch (error) {
      console.error('Failed to add song:', error);
      showToast('新增歌曲失敗，請檢查資料庫規則設定。', 'error');
    } finally {
      hideLoader();
    }
  });

  // --- Custom Music Player Button Events ---
  
  // Play / Pause Toggle
  elements.ctrlPlay.addEventListener('click', () => {
    if (!state.isPlayerReady || !state.player) return;
    
    const playerState = state.player.getPlayerState();
    if (playerState === YT.PlayerState.PLAYING) {
      state.player.pauseVideo();
    } else {
      if (state.activeSongIndex === -1 && state.songs.length > 0) {
        // Play first song if none selected
        playSong(0);
      } else {
        state.player.playVideo();
      }
    }
  });
  
  // Next / Previous
  elements.ctrlNext.addEventListener('click', () => {
    playNextSong();
  });
  
  elements.ctrlPrev.addEventListener('click', () => {
    playPrevSong();
  });
  
  // Volume Slider Change
  elements.volumeSlider.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value);
    if (state.isPlayerReady && state.player) {
      state.player.setVolume(vol);
      if (state.player.isMuted() && vol > 0) {
        state.player.unmute();
        elements.volHighIcon.classList.remove('hidden');
        elements.volMuteIcon.classList.add('hidden');
      }
    }
  });
  
  // Volume Mute Toggle
  elements.ctrlMute.addEventListener('click', () => {
    if (!state.isPlayerReady || !state.player) return;
    
    if (state.player.isMuted()) {
      state.player.unmute();
      elements.volHighIcon.classList.remove('hidden');
      elements.volMuteIcon.classList.add('hidden');
      elements.volumeSlider.value = state.player.getVolume();
    } else {
      state.player.mute();
      elements.volHighIcon.classList.add('hidden');
      elements.volMuteIcon.classList.remove('hidden');
      elements.volumeSlider.value = 0;
    }
  });
  
  // Seek Container Click (Seeking track position)
  elements.seekContainer.addEventListener('click', (e) => {
    if (!state.isPlayerReady || !state.player) return;
    
    const duration = state.player.getDuration();
    if (duration > 0) {
      const rect = elements.seekContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const clickPercent = clickX / width;
      const targetTime = clickPercent * duration;
      
      state.player.seekTo(targetTime, true);
      elements.seekProgress.style.width = `${clickPercent * 100}%`;
      elements.timeCurrent.textContent = formatTime(targetTime);
    }
  });
}
