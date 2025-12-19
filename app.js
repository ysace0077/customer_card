class ConsultationCardManager {
    constructor() {
        this.cards = [];
        this.currentSection = 'upload';
        this.imageFolder = 'images'; // GitHub 이미지 저장 폴더명
        this.dataFile = 'data/consultation_cards.json'; // GitHub 데이터 파일 경로
        this.githubConfig = {
            owner: '', // GitHub 사용자명 또는 조직명 (설정 필요)
            repo: '', // 저장소명 (설정 필요)
            token: '', // GitHub Personal Access Token (설정 필요)
            branch: 'main' // 기본 브랜치
        };
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setDefaultDate();
        this.setupMobileOptimizations();
        this.loadGithubConfig();
        
        // 초기 로드 시 강제 동기화로 브라우저 간 일관성 보장
        console.log('앱 초기화 - 데이터 동기화 시작');
        await this.loadCardsFromGitHub(true); // 강제 새로고침으로 시작
        
        // 페이지 로드 완료 후 추가 동기화 (다른 브라우저에서 변경된 데이터 감지)
        setTimeout(() => {
            if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
                console.log('초기화 후 추가 동기화 실행');
                this.syncData();
            }
        }, 2000);
    }

    loadGithubConfig() {
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (savedConfig.owner && savedConfig.repo && savedConfig.token) {
            this.githubConfig = savedConfig;
            this.updateGithubStatus(true);
            this.startAutoSync();
        } else {
            this.updateGithubStatus(false);
        }
    }

    startAutoSync() {
        // 2분마다 자동 동기화
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            try {
                // 백그라운드에서 조용히 동기화
                await this.loadCardsFromGitHub(true);
                console.log('Auto sync completed:', this.cards.length, 'cards');
                
                // 검색 화면이 활성화되어 있으면 새로고침
                if (this.currentSection === 'search') {
                    this.loadAllCards();
                }
            } catch (error) {
                console.error('Auto sync failed:', error);
            }
        }, 2 * 60 * 1000); // 2분
    }

    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    updateGithubStatus(connected) {
        const githubBtn = document.getElementById('githubConfigBtn');
        if (connected) {
            githubBtn.innerHTML = '⚙️ GitHub 연결됨';
            githubBtn.classList.remove('btn-secondary');
            githubBtn.classList.add('btn-primary');
        } else {
            githubBtn.innerHTML = '⚙️ GitHub 설정';
            githubBtn.classList.remove('btn-primary');
            githubBtn.classList.add('btn-secondary');
        }
    }

    setupMobileOptimizations() {
        // 모바일에서 키보드가 올라올 때 뷰포트 조정
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                document.documentElement.style.height = window.visualViewport.height + 'px';
            });
        }

        // 터치 스크롤 개선
        document.body.style.webkitOverflowScrolling = 'touch';

        // iOS Safari에서 100vh 문제 해결
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', () => {
            setTimeout(setVH, 100);
        });

        // 온라인/오프라인 상태 감지
        window.addEventListener('online', () => {
            this.showMessage('온라인 상태입니다. 데이터를 동기화합니다.', 'info');
            this.syncData();
        });

        window.addEventListener('offline', () => {
            this.showMessage('오프라인 상태입니다. 로컬 데이터를 사용합니다.', 'info');
        });

        // 페이지 포커스 시 자동 동기화 (브라우저 전환 감지)
        window.addEventListener('focus', () => {
            if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
                console.log('페이지 포커스 - 브라우저 간 동기화 시작');
                setTimeout(() => {
                    this.syncData();
                }, 500); // 빠른 동기화
            }
        });

        // 페이지 가시성 변경 시 동기화 (탭 전환 감지)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
                console.log('페이지 가시성 변경 - 브라우저 간 동기화 시작');
                setTimeout(() => {
                    this.syncData();
                }, 500);
            }
        });

        // 브라우저 간 실시간 동기화를 위한 스토리지 이벤트 감지
        window.addEventListener('storage', (e) => {
            if (e.key === 'consultationCards' && e.newValue !== e.oldValue) {
                console.log('다른 탭/브라우저에서 데이터 변경 감지');
                const newCards = JSON.parse(e.newValue || '[]');
                if (newCards.length !== this.cards.length) {
                    console.log('카드 수 변경 감지:', this.cards.length, '->', newCards.length);
                    this.cards = newCards;
                    if (this.currentSection === 'search') {
                        this.loadAllCards();
                    }
                    this.showMessage('다른 브라우저에서 데이터가 업데이트되었습니다.', 'info');
                }
            }
        });

        // 모바일에서 파일 선택 시 카메라 옵션 표시
        this.setupCameraCapture();
    }

    setupCameraCapture() {
        const fileInput = document.getElementById('cardImage');
        
        // 모바일 디바이스 감지
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            fileInput.setAttribute('capture', 'environment');
            
            // 파일 선택 전에 사용자에게 옵션 제공
            fileInput.addEventListener('click', (e) => {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    // 카메라 접근 가능한 경우 추가 안내
                    const fileInfo = document.querySelector('.file-info');
                    fileInfo.textContent = 'JPG 파일 선택 또는 카메라로 직접 촬영하세요.';
                }
            });
        }
    }

    setupImageZoom() {
        this.zoomState = {
            scale: 1,
            translateX: 0,
            translateY: 0,
            isDragging: false,
            lastX: 0,
            lastY: 0,
            isZoomed: false
        };

        const modalImage = document.getElementById('modalImage');
        
        // 이미지 클릭으로 확대 모드 진입 (데스크톱만)
        modalImage.addEventListener('click', (e) => {
            e.stopPropagation();
            // 모바일에서는 클릭 확대 비활성화
            if (window.innerWidth > 768) {
                this.toggleImageZoom();
            }
        });

        // 더블탭으로 리셋 (모바일)
        let lastTap = 0;
        modalImage.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                e.preventDefault();
                this.resetImageZoom();
            }
            lastTap = currentTime;
        });

        // 마우스 휠 줌
        modalImage.addEventListener('wheel', (e) => {
            if (this.zoomState.isZoomed) {
                e.preventDefault();
                this.handleWheelZoom(e);
            }
        });

        // 터치 이벤트 (핀치 줌)
        let initialDistance = 0;
        let initialScale = 1;

        modalImage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                initialDistance = this.getTouchDistance(e.touches);
                initialScale = this.zoomState.scale;
                
                // 핀치 줌 시작 시 자동으로 확대 모드 진입
                if (!this.zoomState.isZoomed) {
                    this.zoomState.isZoomed = true;
                    this.showZoomControls();
                }
            } else if (e.touches.length === 1) {
                // 확대된 상태에서만 드래그 가능
                if (this.zoomState.isZoomed && this.zoomState.scale > 1) {
                    this.zoomState.isDragging = true;
                    this.zoomState.lastX = e.touches[0].clientX;
                    this.zoomState.lastY = e.touches[0].clientY;
                }
            }
        });

        modalImage.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = this.getTouchDistance(e.touches);
                const scale = initialScale * (currentDistance / initialDistance);
                const newScale = Math.max(1, Math.min(5, scale));
                this.setImageScale(newScale);
                
                // 스케일이 1에 가까우면 자동으로 리셋
                if (newScale <= 1.1) {
                    this.resetImageZoom();
                }
            } else if (e.touches.length === 1 && this.zoomState.isDragging) {
                e.preventDefault();
                const deltaX = e.touches[0].clientX - this.zoomState.lastX;
                const deltaY = e.touches[0].clientY - this.zoomState.lastY;
                this.moveImage(deltaX, deltaY);
                this.zoomState.lastX = e.touches[0].clientX;
                this.zoomState.lastY = e.touches[0].clientY;
            }
        });

        modalImage.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.zoomState.isDragging = false;
            }
        });

        // 마우스 드래그
        modalImage.addEventListener('mousedown', (e) => {
            if (this.zoomState.isZoomed) {
                e.preventDefault();
                this.zoomState.isDragging = true;
                this.zoomState.lastX = e.clientX;
                this.zoomState.lastY = e.clientY;
                modalImage.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.zoomState.isDragging && this.zoomState.isZoomed) {
                e.preventDefault();
                const deltaX = e.clientX - this.zoomState.lastX;
                const deltaY = e.clientY - this.zoomState.lastY;
                this.moveImage(deltaX, deltaY);
                this.zoomState.lastX = e.clientX;
                this.zoomState.lastY = e.clientY;
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.zoomState.isDragging) {
                this.zoomState.isDragging = false;
                modalImage.style.cursor = this.zoomState.isZoomed ? 'grab' : 'zoom-in';
            }
        });
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    toggleImageZoom() {
        const modalImage = document.getElementById('modalImage');
        
        if (!this.zoomState.isZoomed) {
            // 확대 모드 진입
            this.zoomState.isZoomed = true;
            this.setImageScale(2);
            modalImage.style.cursor = 'grab';
            this.showZoomControls();
        } else {
            // 원래 크기로 복원
            this.resetImageZoom();
        }
    }

    setImageScale(scale) {
        const modalImage = document.getElementById('modalImage');
        this.zoomState.scale = scale;
        this.updateImageTransform();
    }

    moveImage(deltaX, deltaY) {
        this.zoomState.translateX += deltaX;
        this.zoomState.translateY += deltaY;
        this.updateImageTransform();
    }

    updateImageTransform() {
        const modalImage = document.getElementById('modalImage');
        modalImage.style.transform = `translate(${this.zoomState.translateX}px, ${this.zoomState.translateY}px) scale(${this.zoomState.scale})`;
        modalImage.style.transition = this.zoomState.isDragging ? 'none' : 'transform 0.3s ease';
    }

    resetImageZoom() {
        const modalImage = document.getElementById('modalImage');
        this.zoomState = {
            scale: 1,
            translateX: 0,
            translateY: 0,
            isDragging: false,
            lastX: 0,
            lastY: 0,
            isZoomed: false
        };
        modalImage.style.transform = 'none';
        modalImage.style.cursor = 'zoom-in';
        modalImage.style.transition = 'transform 0.3s ease';
        this.hideZoomControls();
    }

    handleWheelZoom(e) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(1, Math.min(5, this.zoomState.scale * delta));
        this.setImageScale(newScale);
        
        if (newScale === 1) {
            this.resetImageZoom();
        }
    }

    showZoomControls() {
        // 모바일에서는 힌트만 표시
        const isMobile = window.innerWidth <= 768;
        
        let controls = document.getElementById('zoomControls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'zoomControls';
            controls.className = 'zoom-controls';
            
            if (isMobile) {
                // 모바일: 힌트만 표시
                controls.innerHTML = `
                    <div class="zoom-hint mobile">핀치로 확대/축소 | 드래그로 이동 | 더블탭으로 리셋</div>
                `;
            } else {
                // 데스크톱: 버튼과 힌트 표시
                controls.innerHTML = `
                    <button class="zoom-btn" id="zoomIn">🔍+</button>
                    <button class="zoom-btn" id="zoomOut">🔍-</button>
                    <button class="zoom-btn" id="zoomReset">⌂</button>
                    <div class="zoom-hint">클릭: 확대/축소 | 드래그: 이동 | 휠: 줌 | 키보드: +/-/0/방향키</div>
                `;
                
                // 데스크톱 줌 컨트롤 이벤트
                document.getElementById('zoomIn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.setImageScale(Math.min(5, this.zoomState.scale * 1.2));
                });

                document.getElementById('zoomOut').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newScale = Math.max(1, this.zoomState.scale * 0.8);
                    this.setImageScale(newScale);
                    if (newScale === 1) {
                        this.resetImageZoom();
                    }
                });

                document.getElementById('zoomReset').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.resetImageZoom();
                });
            }
            
            document.querySelector('.modal-content').appendChild(controls);
        }
        controls.style.display = 'flex';
    }

    hideZoomControls() {
        const controls = document.getElementById('zoomControls');
        if (controls) {
            controls.style.display = 'none';
        }
    }

    bindEvents() {
        // 네비게이션 버튼
        document.getElementById('uploadBtn').addEventListener('click', () => this.showSection('upload'));
        document.getElementById('searchBtn').addEventListener('click', () => this.showSection('search'));

        // 업로드 폼
        document.getElementById('uploadForm').addEventListener('submit', (e) => this.handleUpload(e));

        // 검색 기능
        document.getElementById('searchExecute').addEventListener('click', () => this.searchCards());
        document.getElementById('searchExecute').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.searchCards();
        });
        document.getElementById('searchCustomer').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCards();
        });
        // 모바일에서 입력 완료 시 자동 검색
        document.getElementById('searchCustomer').addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchCards();
            }, 500); // 0.5초 후 자동 검색
        });
        
        // 모바일에서 한글 입력 완료 감지
        document.getElementById('searchCustomer').addEventListener('compositionend', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchCards();
            }, 300);
        });
        
        // 모바일에서 포커스 아웃 시 검색
        document.getElementById('searchCustomer').addEventListener('blur', () => {
            this.searchCards();
        });
        document.getElementById('filterBtn').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilterBtn').addEventListener('click', () => this.resetFilters());


        // 모달
        document.getElementById('imageModal').addEventListener('click', (e) => {
            if (e.target.id === 'imageModal') this.closeModal();
        });
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        
        // 이미지 확대 보기 기능
        this.setupImageZoom();

        // 파일 입력 검증
        document.getElementById('cardImage').addEventListener('change', (e) => this.validateFile(e));
        
        // GitHub 설정 버튼
        document.getElementById('githubConfigBtn').addEventListener('click', () => this.showGithubConfig());
        
        // 동기화 버튼
        document.getElementById('syncBtn').addEventListener('click', () => {
            // 동기화 버튼 시각적 피드백
            const syncBtn = document.getElementById('syncBtn');
            syncBtn.innerHTML = '🔄 동기화 중...';
            syncBtn.disabled = true;
            
            this.syncData().finally(() => {
                syncBtn.innerHTML = '🔄 동기화';
                syncBtn.disabled = false;
            });
        });

        // 디버그/상태확인 버튼
        document.getElementById('debugBtn').addEventListener('click', () => {
            this.showDebugInfo();
        });
        
        // 필터 섹션 토글
        this.setupFilterToggle();
        
        // 빠른 필터 버튼들
        this.setupQuickFilters();
        this.setupSalespersonFilters();
        

    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('consultationDate').value = today;
    }

    showSection(section) {
        document.getElementById('uploadSection').classList.toggle('hidden', section !== 'upload');
        document.getElementById('searchSection').classList.toggle('hidden', section !== 'search');
        
        // 버튼 활성화 상태 업데이트
        document.getElementById('uploadBtn').classList.toggle('btn-primary', section === 'upload');
        document.getElementById('uploadBtn').classList.toggle('btn-secondary', section !== 'upload');
        document.getElementById('searchBtn').classList.toggle('btn-primary', section === 'search');
        document.getElementById('searchBtn').classList.toggle('btn-secondary', section !== 'search');

        this.currentSection = section;

        if (section === 'search') {
            console.log('검색 탭 활성화 - 데이터 동기화 확인');
            
            // 검색 탭 진입 시 자동 동기화로 최신 데이터 보장
            if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
                this.syncData().then(() => {
                    console.log('검색 탭 동기화 완료, 카드 수:', this.cards.length);
                    this.loadAllCards();
                });
            } else {
                console.log('GitHub 설정 없음 - 로컬 데이터 사용, 카드 수:', this.cards.length);
                this.loadAllCards();
            }
            
            // 모바일에서 필터 상태 초기화
            setTimeout(() => {
                this.ensureFiltersVisible();
            }, 100);
        }
    }

    validateFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            this.showMessage('JPG 파일만 업로드 가능합니다.', 'error');
            event.target.value = '';
            return false;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showMessage('파일 크기는 10MB 이하여야 합니다.', 'error');
            event.target.value = '';
            return false;
        }

        return true;
    }

    async handleUpload(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const file = formData.get('cardImage');
        
        if (!this.validateFile({target: {files: [file]}})) {
            return;
        }

        try {
            // 고유한 파일명 생성
            const timestamp = Date.now();
            const customerName = formData.get('customerName').replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const salesperson = formData.get('salesperson').replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const date = formData.get('consultationDate').replace(/-/g, '');
            
            const newFileName = `${date}_${salesperson}_${customerName}_${timestamp}.jpg`;
            const imagePath = `${this.imageFolder}/${newFileName}`;

            // 이미지 해상도를 최대한 유지하면서 최적화
            const imageData = await this.processImageWithMaxResolution(file);
            
            const cardData = {
                id: timestamp.toString(),
                salesperson: formData.get('salesperson'),
                customerName: formData.get('customerName'),
                consultationDate: formData.get('consultationDate'),
                notes: formData.get('notes'),
                purchaseCompleted: false, // 구매 완료 상태 (기본값: false)
                imageData: imageData, // Base64 데이터 (브라우저 표시용)
                imagePath: imagePath, // 파일 경로
                fileName: newFileName, // 새로운 파일명
                originalFileName: file.name, // 원본 파일명
                uploadDate: new Date().toISOString(),
                fileSize: file.size,
                originalWidth: this.lastProcessedImageWidth,
                originalHeight: this.lastProcessedImageHeight
            };

            this.cards.push(cardData);
            await this.saveCards();
            
            // GitHub에 이미지 업로드
            const githubImageUrl = await this.uploadImageToGitHub(imageData, newFileName);
            if (githubImageUrl) {
                cardData.githubImageUrl = githubImageUrl;
                // 중요: 모든 브라우저에서 일관성을 위해 GitHub URL을 우선 사용
                cardData.imageData = githubImageUrl;
                cardData.imageSource = 'github'; // 이미지 소스 표시
                console.log('GitHub 이미지 업로드 완료:', githubImageUrl);
            } else {
                // GitHub 업로드 실패 시 Base64 유지
                cardData.imageSource = 'base64';
                console.log('GitHub 업로드 실패 - Base64 데이터 유지');
            }
            
            this.showMessage('상담 카드가 성공적으로 업로드되었습니다.', 'success');
            event.target.reset();
            this.setDefaultDate();
            
            // 업로드 후 다른 기기에서 즉시 확인할 수 있도록 강제 동기화
            setTimeout(() => {
                console.log('업로드 완료 - 동기화 신호 전송');
            }, 2000);

        } catch (error) {
            console.error('Upload error:', error);
            this.showMessage('업로드 중 오류가 발생했습니다.', 'error');
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async processImageWithMaxResolution(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                // 원본 해상도 저장
                this.lastProcessedImageWidth = img.naturalWidth;
                this.lastProcessedImageHeight = img.naturalHeight;
                
                // 최대 해상도 설정 (4K 해상도까지 지원)
                const MAX_WIDTH = 3840;
                const MAX_HEIGHT = 2160;
                
                let { width, height } = img;
                
                // 비율을 유지하면서 최대 크기 제한
                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                } else {
                    // 원본 크기가 최대 크기보다 작으면 원본 크기 유지
                    width = img.naturalWidth;
                    height = img.naturalHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 고품질 렌더링 설정
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // 이미지 그리기
                ctx.drawImage(img, 0, 0, width, height);
                
                // 고품질 JPEG로 변환 (품질 95%)
                const dataURL = canvas.toDataURL('image/jpeg', 0.95);
                resolve(dataURL);
            };
            
            img.onerror = reject;
            
            // 파일을 이미지로 로드
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async saveCards() {
        // 로컬 백업 (오프라인 지원)
        localStorage.setItem('consultationCards', JSON.stringify(this.cards));
        
        // GitHub에 데이터 저장
        await this.saveCardsToGitHub();
    }

    async loadCardsFromGitHub(forceRefresh = false) {
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (!savedConfig.owner || !savedConfig.repo || !savedConfig.token) {
            // GitHub 설정이 없으면 로컬 데이터 사용
            this.cards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
            console.log('GitHub 설정 없음 - 로컬 데이터 사용:', this.cards.length, '개');
            return;
        }

        this.githubConfig = savedConfig;
        console.log('GitHub에서 데이터 로드 시작:', this.githubConfig.owner + '/' + this.githubConfig.repo);

        try {
            if (!forceRefresh) {
                this.showMessage('데이터를 불러오는 중...', 'info');
            }
            
            // 강력한 캐시 무시 설정
            const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
            const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}${cacheBuster}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'If-None-Match': '' // ETag 무시
                },
                cache: 'no-store' // 브라우저 캐시 완전 무시
            });

            if (response.ok) {
                const data = await response.json();
                console.log('GitHub 응답 받음, SHA:', data.sha?.substring(0, 8));
                
                // UTF-8 Base64 디코딩
                const binaryString = atob(data.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const content = new TextDecoder('utf-8').decode(bytes);
                const githubCards = JSON.parse(content);
                
                console.log('GitHub에서 로드된 카드 수:', githubCards.length);
                console.log('기존 로컬 카드 수:', this.cards.length);
                
                // 데이터 무결성 검증 및 이미지 URL 정규화
                if (Array.isArray(githubCards)) {
                    // 모든 카드의 이미지 URL을 GitHub URL로 정규화
                    this.cards = githubCards.map(card => {
                        if (card.githubImageUrl && card.githubImageUrl !== card.imageData) {
                            console.log(`카드 ${card.customerName}: 이미지 URL 정규화`, card.githubImageUrl);
                            return {
                                ...card,
                                imageData: card.githubImageUrl,
                                imageSource: 'github'
                            };
                        } else if (card.imageData && card.imageData.startsWith('data:')) {
                            // Base64 데이터인 경우 표시
                            return {
                                ...card,
                                imageSource: 'base64'
                            };
                        } else if (card.imageData && card.imageData.startsWith('http')) {
                            // 이미 GitHub URL인 경우
                            return {
                                ...card,
                                imageSource: 'github'
                            };
                        }
                        return card;
                    });
                    
                    // 로컬에도 백업 (타임스탬프 포함)
                    const backupData = {
                        cards: this.cards,
                        lastSync: new Date().toISOString(),
                        source: 'github',
                        sha: data.sha,
                        normalizedImages: true
                    };
                    localStorage.setItem('consultationCards', JSON.stringify(this.cards));
                    localStorage.setItem('consultationCardsBackup', JSON.stringify(backupData));
                    
                    console.log('데이터 동기화 완료:', this.cards.length, '개 카드');
                    console.log('이미지 소스 분포:', this.getImageSourceStats());
                    this.showMessage(`${this.cards.length}개의 상담 카드를 불러왔습니다. (${new Date().toLocaleTimeString()})`, 'success');
                } else {
                    throw new Error('GitHub에서 받은 데이터가 올바르지 않습니다.');
                }
            } else if (response.status === 404) {
                console.log('GitHub 파일 없음 - 새 파일 생성');
                // 파일이 없으면 빈 배열로 시작
                this.cards = [];
                await this.saveCardsToGitHub(); // 빈 파일 생성
                this.showMessage('새로운 데이터 파일을 생성했습니다.', 'info');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('GitHub 로드 실패:', error);
            // GitHub에서 불러오기 실패 시 로컬 데이터 사용
            const localCards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
            this.cards = localCards;
            console.log('로컬 백업 데이터 사용:', this.cards.length, '개');
            this.showMessage(`GitHub 연결 실패 - 로컬 데이터 사용 (${this.cards.length}개)`, 'info');
        }
    }

    async saveCardsToGitHub() {
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (!savedConfig.owner || !savedConfig.repo || !savedConfig.token) {
            return; // GitHub 설정이 없으면 로컬만 저장
        }

        this.githubConfig = savedConfig;

        try {
            // 현재 파일의 SHA 값 가져오기 (업데이트를 위해 필요)
            let sha = null;
            try {
                const currentFile = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}`, {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (currentFile.ok) {
                    const currentData = await currentFile.json();
                    sha = currentData.sha;
                }
            } catch (e) {
                // 파일이 없으면 새로 생성
            }

            // 데이터를 JSON 문자열로 변환 후 UTF-8 Base64 인코딩
            const jsonString = JSON.stringify(this.cards, null, 2);
            const content = btoa(new TextEncoder().encode(jsonString).reduce((data, byte) => data + String.fromCharCode(byte), ''));

            const requestBody = {
                message: `Update consultation cards data - ${new Date().toISOString()}`,
                content: content,
                branch: this.githubConfig.branch
            };

            if (sha) {
                requestBody.sha = sha; // 기존 파일 업데이트
            }

            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`GitHub API Error: ${error.message}`);
            }

            console.log('Data saved to GitHub successfully');
        } catch (error) {
            console.error('Failed to save data to GitHub:', error);
            this.showMessage(`GitHub 저장 실패: ${error.message}`, 'error');
        }
    }



    searchCards() {
        // 통합 필터 적용 (검색어 + 판매자 + 기간)
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchCustomer').value.toLowerCase().trim();
        const activeSalespersonBtn = document.querySelector('.salesperson-filter-btn.active');
        const salesperson = activeSalespersonBtn ? activeSalespersonBtn.dataset.salesperson : '';
        
        // 활성화된 기간 필터 버튼 확인
        const activePeriodBtn = document.querySelector('.quick-filter-btn.active');
        const period = activePeriodBtn ? activePeriodBtn.dataset.period : 'all';
        
        let filteredCards = this.cards;

        // 고객명 필터
        if (searchTerm) {
            filteredCards = filteredCards.filter(card => 
                card.customerName.toLowerCase().includes(searchTerm)
            );
        }

        // 판매자 필터
        if (salesperson) {
            filteredCards = filteredCards.filter(card => card.salesperson === salesperson);
        }

        // 기간 필터
        if (period && period !== 'all') {
            const { dateFrom, dateTo } = this.getPeriodDates(period);
            if (dateFrom) {
                filteredCards = filteredCards.filter(card => card.consultationDate >= dateFrom);
            }
            if (dateTo) {
                filteredCards = filteredCards.filter(card => card.consultationDate <= dateTo);
            }
        }

        this.displayCards(filteredCards);
        
        // 필터 적용 메시지
        const filterCount = filteredCards.length;
        const totalCount = this.cards.length;
        if (filterCount < totalCount) {
            this.showMessage(`${totalCount}개 중 ${filterCount}개 카드가 필터 조건에 맞습니다.`, 'info');
        }
    }

    getPeriodDates(period) {
        const today = new Date();
        let dateFrom = '';
        let dateTo = '';

        switch(period) {
            case 'week':
                // 금주 (월요일부터 일요일까지)
                const weekStart = new Date(today);
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                weekStart.setDate(today.getDate() + mondayOffset);
                
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                dateFrom = weekStart.toISOString().split('T')[0];
                dateTo = weekEnd.toISOString().split('T')[0];
                break;
            case 'month':
                // 당월
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                dateFrom = monthStart.toISOString().split('T')[0];
                dateTo = monthEnd.toISOString().split('T')[0];
                break;
            case 'lastMonth':
                // 지난 달
                const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                dateFrom = lastMonthStart.toISOString().split('T')[0];
                dateTo = lastMonthEnd.toISOString().split('T')[0];
                break;
        }

        return { dateFrom, dateTo };
    }

    ensureFiltersVisible() {
        // 모바일에서 필터가 숨겨져 있을 수 있으므로 강제로 표시
        const filterContent = document.querySelector('.filter-content');
        if (filterContent) {
            filterContent.style.display = 'flex';
        }
        
        // 기본 필터 상태 확인
        const allPeriodBtn = document.querySelector('.quick-filter-btn[data-period="all"]');
        const allSalespersonBtn = document.querySelector('.salesperson-filter-btn[data-salesperson=""]');
        
        if (allPeriodBtn && !document.querySelector('.quick-filter-btn.active')) {
            allPeriodBtn.classList.add('active');
        }
        
        if (allSalespersonBtn && !document.querySelector('.salesperson-filter-btn.active')) {
            allSalespersonBtn.classList.add('active');
        }
    }

    resetFilters() {
        // 모든 필터 초기화
        document.getElementById('searchCustomer').value = '';
        
        // 빠른 필터 버튼들 초기화
        document.querySelectorAll('.quick-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.salesperson-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        
        // 기본 버튼 활성화
        document.querySelector('.quick-filter-btn[data-period="all"]')?.classList.add('active');
        document.querySelector('.salesperson-filter-btn[data-salesperson=""]')?.classList.add('active');
        
        // 전체 카드 표시
        this.loadAllCards();
        this.showMessage('모든 필터가 초기화되었습니다.', 'info');
    }

    setupQuickFilters() {
        const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
        
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 모든 버튼에서 active 클래스 제거
                quickFilterBtns.forEach(b => b.classList.remove('active'));
                // 클릭된 버튼에 active 클래스 추가
                btn.classList.add('active');
                
                const period = btn.dataset.period;
                this.applyQuickFilter(period);
            });
        });
    }

    applyQuickFilter(period) {
        // 통합 필터 적용
        this.applyFilters();
        
        // 메시지 표시
        const messages = {
            week: '금주',
            month: '당월',
            lastMonth: '지난 달',
            all: '전체 기간'
        };
        this.showMessage(`${messages[period]} 필터가 적용되었습니다.`, 'info');
    }

    setupSalespersonFilters() {
        const salespersonFilterBtns = document.querySelectorAll('.salesperson-filter-btn');
        
        salespersonFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 모든 버튼에서 active 클래스 제거
                salespersonFilterBtns.forEach(b => b.classList.remove('active'));
                // 클릭된 버튼에 active 클래스 추가
                btn.classList.add('active');
                
                const salesperson = btn.dataset.salesperson;
                this.applySalespersonFilter(salesperson);
            });
        });
    }

    applySalespersonFilter(salesperson) {
        // 통합 필터 적용
        this.applyFilters();
        
        // 메시지 표시
        const message = salesperson ? `${salesperson} 필터가 적용되었습니다.` : '전체 판매자 필터가 적용되었습니다.';
        this.showMessage(message, 'info');
    }



    setupFilterToggle() {
        const filterTitle = document.querySelector('.filter-title');
        const filterContent = document.querySelector('.filter-content');
        
        // 초기 상태: 펼쳐짐 (사용자가 바로 사용할 수 있도록)
        let isExpanded = true;
        filterContent.style.display = 'flex';
        filterTitle.innerHTML = '🔼 상세 필터';
        
        filterTitle.addEventListener('click', () => {
            isExpanded = !isExpanded;
            
            if (isExpanded) {
                filterContent.style.display = 'flex';
                filterTitle.innerHTML = '🔼 상세 필터';
            } else {
                filterContent.style.display = 'none';
                filterTitle.innerHTML = '🔽 상세 필터';
            }
        });
    }







    loadAllCards() {
        this.displayCards(this.cards);
    }

    displayCards(cards) {
        const resultsContainer = document.getElementById('searchResults');
        
        // 모바일 디버깅 정보
        console.log('displayCards 호출됨, 카드 수:', cards.length, '전체 카드 수:', this.cards.length);
        
        if (cards.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">📭 검색 결과가 없습니다.</div>';
            return;
        }

        // 최신 순으로 정렬
        const sortedCards = cards.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        resultsContainer.innerHTML = sortedCards.map(card => `
            <div class="card-item text-only" ontouchstart="">
                <button class="delete-btn" onclick="event.stopPropagation(); consultationManager.confirmDelete('${card.id}')" title="카드 삭제">
                    🗑️
                </button>
                <div class="card-info" onclick="consultationManager.openFullscreenModal('${card.id}')">
                    <h3>👤 ${card.customerName}</h3>
                    <p class="salesperson">👨‍💼 ${card.salesperson}</p>
                    <p class="date">📅 ${this.formatDate(card.consultationDate)}</p>
                    <p class="upload-date">⏰ ${this.formatDateTime(card.uploadDate)}</p>
                    ${card.notes ? `<p class="notes">📝 ${this.truncateText(card.notes, 80)}</p>` : ''}
                    <p class="view-hint">👆 클릭: 이미지 보기</p>
                </div>
            </div>
        `).join('');
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }



    confirmDelete(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // 삭제 확인 모달 생성
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal delete-confirm-modal';
        confirmModal.innerHTML = `
            <div class="modal-content delete-confirm-content">
                <h3>⚠️ 상담 카드 삭제</h3>
                <div class="delete-card-info">
                    <p><strong>고객명:</strong> ${card.customerName}</p>
                    <p><strong>판매자:</strong> ${card.salesperson}</p>
                    <p><strong>상담일:</strong> ${this.formatDate(card.consultationDate)}</p>
                </div>
                <p class="delete-warning">이 상담 카드를 정말 삭제하시겠습니까?<br>삭제된 데이터는 복구할 수 없습니다.</p>
                <div class="delete-actions">
                    <button class="btn btn-secondary" onclick="consultationManager.closeDeleteConfirm()">취소</button>
                    <button class="btn btn-danger" onclick="consultationManager.deleteCard('${cardId}')">삭제</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        confirmModal.style.display = 'block';
    }

    closeDeleteConfirm() {
        const modal = document.querySelector('.delete-confirm-modal');
        if (modal) {
            modal.remove();
        }
    }

    async deleteCard(cardId) {
        try {
            // 카드 찾기
            const cardIndex = this.cards.findIndex(c => c.id === cardId);
            if (cardIndex === -1) {
                this.showMessage('삭제할 카드를 찾을 수 없습니다.', 'error');
                return;
            }

            const card = this.cards[cardIndex];

            // GitHub에서 이미지 파일 삭제 (선택사항)
            await this.deleteImageFromGitHub(card.fileName);

            // 카드 배열에서 제거
            this.cards.splice(cardIndex, 1);

            // 데이터 저장
            await this.saveCards();

            // 화면 업데이트
            if (this.currentSection === 'search') {
                this.loadAllCards();
            }

            // 확인 모달 닫기
            this.closeDeleteConfirm();
            
            // 이미지 모달도 닫기 (열려있는 경우)
            this.closeModal();

            this.showMessage('상담 카드가 삭제되었습니다.', 'success');
            
            // 삭제 후 다른 기기에서 즉시 확인할 수 있도록 강제 동기화
            setTimeout(() => {
                console.log('삭제 완료 - 동기화 신호 전송');
            }, 2000);

        } catch (error) {
            console.error('Delete error:', error);
            this.showMessage('삭제 중 오류가 발생했습니다.', 'error');
        }
    }

    async deleteImageFromGitHub(fileName) {
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (!savedConfig.owner || !savedConfig.repo || !savedConfig.token) {
            return; // GitHub 설정이 없으면 스킵
        }

        this.githubConfig = savedConfig;
        const filePath = `${this.imageFolder}/${fileName}`;

        try {
            // 파일 정보 가져오기 (SHA 값 필요)
            const fileResponse = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}`, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                
                // 파일 삭제
                const deleteResponse = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete consultation card image: ${fileName}`,
                        sha: fileData.sha,
                        branch: this.githubConfig.branch
                    })
                });

                if (deleteResponse.ok) {
                    console.log('Image deleted from GitHub successfully');
                } else {
                    console.warn('Failed to delete image from GitHub');
                }
            }
        } catch (error) {
            console.warn('Failed to delete image from GitHub:', error);
            // 이미지 삭제 실패는 치명적이지 않으므로 경고만 출력
        }
    }

    openModal(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalInfo = document.getElementById('modalInfo');

        // 이미지 줌 상태 초기화
        this.resetImageZoom();
        
        modalImage.src = card.imageData;
        modalImage.style.cursor = 'zoom-in';
        
        const isMobile = window.innerWidth <= 768;
        const zoomInstruction = isMobile 
            ? '💡 두 손가락으로 핀치하여 확대/축소할 수 있습니다'
            : '💡 이미지를 클릭하면 확대할 수 있습니다';
        
        modalInfo.innerHTML = `
            <div class="modal-header">
                <h3>${card.customerName} - 상담 카드</h3>
                <div class="modal-actions">
                    <button class="modal-delete-btn" onclick="consultationManager.confirmDelete('${card.id}')" title="카드 삭제">
                        🗑️ 삭제
                    </button>
                </div>
            </div>
            <p><strong>판매자:</strong> ${card.salesperson}</p>
            <p><strong>상담 날짜:</strong> ${this.formatDate(card.consultationDate)}</p>
            <p><strong>업로드 날짜:</strong> ${this.formatDateTime(card.uploadDate)}</p>
            <p><strong>파일명:</strong> ${card.fileName}</p>
            <p><strong>파일 크기:</strong> ${this.formatFileSize(card.fileSize)}</p>
            ${card.originalWidth && card.originalHeight ? 
                `<p><strong>이미지 해상도:</strong> ${card.originalWidth} × ${card.originalHeight}</p>` : ''}
            ${card.notes ? `<p><strong>메모:</strong> ${card.notes}</p>` : ''}
            <p class="zoom-instruction">${zoomInstruction}</p>
        `;

        modal.style.display = 'block';
    }

    openFullscreenModal(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // 전체 화면 모달 생성
        const fullscreenModal = document.createElement('div');
        fullscreenModal.className = 'fullscreen-modal';
        fullscreenModal.innerHTML = `
            <div class="fullscreen-content">
                <div class="fullscreen-header">
                    <div class="fullscreen-info">
                        <h3>${card.customerName}</h3>
                        <p>${card.salesperson} | ${this.formatDate(card.consultationDate)}</p>
                    </div>
                    <div class="fullscreen-actions">
                        <button class="fullscreen-close-btn" onclick="consultationManager.closeFullscreenModal()">
                            ✕
                        </button>
                    </div>
                </div>
                <div class="fullscreen-image-container">
                    <img src="${card.imageData}" alt="상담 카드" class="fullscreen-image">
                </div>
            </div>
        `;
        
        document.body.appendChild(fullscreenModal);
        
        // 전체 화면 모달 표시
        setTimeout(() => {
            fullscreenModal.classList.add('show');
        }, 10);
        
        // ESC 키로 닫기
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeFullscreenModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    closeFullscreenModal() {
        const modal = document.querySelector('.fullscreen-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }



    closeModal() {
        document.getElementById('imageModal').style.display = 'none';
        this.resetImageZoom();
        this.hideZoomControls();
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR');
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showMessage(message, type) {
        // 기존 메시지 제거
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // 모바일에서 더 명확한 아이콘 추가
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        
        messageDiv.innerHTML = `${icons[type] || ''} ${message}`;

        const currentSection = this.currentSection === 'upload' ? 
            document.getElementById('uploadForm') : 
            document.getElementById('searchSection');
            
        currentSection.parentNode.insertBefore(messageDiv, currentSection);

        // 모바일에서 햅틱 피드백 (지원되는 경우)
        if (navigator.vibrate) {
            if (type === 'success') {
                navigator.vibrate(100);
            } else if (type === 'error') {
                navigator.vibrate([100, 50, 100]);
            }
        }

        // 3초 후 메시지 제거 (모바일에서는 4초)
        const isMobile = window.innerWidth <= 768;
        setTimeout(() => {
            messageDiv.remove();
        }, isMobile ? 4000 : 3000);
    }

    // GitHub 설정 관리
    showGithubConfig() {
        const modal = document.getElementById('githubConfigModal');
        if (!modal) {
            this.createGithubConfigModal();
        }
        
        // 저장된 설정 불러오기
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        document.getElementById('githubOwner').value = savedConfig.owner || '';
        document.getElementById('githubRepo').value = savedConfig.repo || '';
        document.getElementById('githubToken').value = savedConfig.token || '';
        document.getElementById('githubBranch').value = savedConfig.branch || 'main';
        
        document.getElementById('githubConfigModal').style.display = 'block';
    }

    createGithubConfigModal() {
        const modalHtml = `
            <div id="githubConfigModal" class="modal">
                <div class="modal-content">
                    <span class="close" onclick="consultationManager.closeGithubConfig()">&times;</span>
                    <h2>GitHub 저장소 설정</h2>
                    <div class="github-config-form">
                        <div class="form-group">
                            <label for="githubOwner">GitHub 사용자명/조직명:</label>
                            <input type="text" id="githubOwner" placeholder="예: myusername">
                        </div>
                        <div class="form-group">
                            <label for="githubRepo">저장소명:</label>
                            <input type="text" id="githubRepo" placeholder="예: consultation-cards">
                        </div>
                        <div class="form-group">
                            <label for="githubToken">Personal Access Token:</label>
                            <input type="password" id="githubToken" placeholder="ghp_...">
                            <div class="file-info">
                                <a href="https://github.com/settings/tokens" target="_blank">
                                    GitHub에서 토큰 생성하기
                                </a> (Contents 권한 필요)
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="githubBranch">브랜치명:</label>
                            <input type="text" id="githubBranch" value="main">
                        </div>
                        <div class="github-config-buttons">
                            <button class="btn btn-primary" onclick="consultationManager.saveGithubConfig()">
                                💾 설정 저장
                            </button>
                            <button class="btn btn-secondary" onclick="consultationManager.testGithubConnection()">
                                🔗 연결 테스트
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    closeGithubConfig() {
        document.getElementById('githubConfigModal').style.display = 'none';
    }

    saveGithubConfig() {
        const config = {
            owner: document.getElementById('githubOwner').value.trim(),
            repo: document.getElementById('githubRepo').value.trim(),
            token: document.getElementById('githubToken').value.trim(),
            branch: document.getElementById('githubBranch').value.trim() || 'main'
        };

        if (!config.owner || !config.repo || !config.token) {
            this.showMessage('모든 필수 항목을 입력해주세요.', 'error');
            return;
        }

        this.githubConfig = config;
        localStorage.setItem('githubConfig', JSON.stringify(config));
        this.updateGithubStatus(true);
        this.showMessage('GitHub 설정이 저장되었습니다.', 'success');
        this.closeGithubConfig();
    }

    async testGithubConnection() {
        const config = {
            owner: document.getElementById('githubOwner').value.trim(),
            repo: document.getElementById('githubRepo').value.trim(),
            token: document.getElementById('githubToken').value.trim(),
            branch: document.getElementById('githubBranch').value.trim() || 'main'
        };

        if (!config.owner || !config.repo || !config.token) {
            this.showMessage('모든 필수 항목을 입력해주세요.', 'error');
            return;
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                this.showMessage('GitHub 연결이 성공했습니다! ✅', 'success');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('GitHub connection test failed:', error);
            this.showMessage(`연결 실패: ${error.message}`, 'error');
        }
    }

    showDebugInfo() {
        const browserInfo = navigator.userAgent;
        const localCards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
        const githubConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        const lastSyncInfo = JSON.parse(localStorage.getItem('lastSyncInfo') || '{}');
        const backupInfo = JSON.parse(localStorage.getItem('consultationCardsBackup') || '{}');

        const debugModal = document.createElement('div');
        debugModal.className = 'modal debug-modal';
        debugModal.innerHTML = `
            <div class="modal-content debug-content">
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                <h2>🔍 동기화 상태 확인</h2>
                <div class="debug-info">
                    <h3>📱 브라우저 정보</h3>
                    <p><strong>User Agent:</strong> ${browserInfo}</p>
                    <p><strong>현재 시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
                    
                    <h3>💾 데이터 상태</h3>
                    <p><strong>메모리 카드 수:</strong> ${this.cards.length}개</p>
                    <p><strong>로컬 스토리지 카드 수:</strong> ${localCards.length}개</p>
                    <p><strong>일치 여부:</strong> ${this.cards.length === localCards.length ? '✅ 일치' : '❌ 불일치'}</p>
                    
                    <h3>🖼️ 이미지 저장 상태</h3>
                    ${(() => {
                        const stats = this.getImageSourceStats();
                        return `
                            <p><strong>GitHub URL:</strong> ${stats.github}개</p>
                            <p><strong>Base64 데이터:</strong> ${stats.base64}개</p>
                            <p><strong>알 수 없음:</strong> ${stats.unknown}개</p>
                            <p><strong>상태:</strong> ${stats.base64 > 0 ? '⚠️ 혼재' : '✅ 정규화됨'}</p>
                        `;
                    })()}
                    
                    <h3>🔗 GitHub 설정</h3>
                    <p><strong>저장소:</strong> ${githubConfig.owner ? `${githubConfig.owner}/${githubConfig.repo}` : '❌ 설정 안됨'}</p>
                    <p><strong>브랜치:</strong> ${githubConfig.branch || 'main'}</p>
                    <p><strong>토큰:</strong> ${githubConfig.token ? '✅ 설정됨 (' + githubConfig.token.substring(0, 8) + '...)' : '❌ 설정 안됨'}</p>
                    
                    <h3>🔄 마지막 동기화</h3>
                    <p><strong>시간:</strong> ${lastSyncInfo.timestamp ? new Date(lastSyncInfo.timestamp).toLocaleString('ko-KR') : '없음'}</p>
                    <p><strong>브라우저:</strong> ${lastSyncInfo.browser || '없음'}</p>
                    <p><strong>카드 수:</strong> ${lastSyncInfo.cardCount || 0}개</p>
                    <p><strong>작업:</strong> ${lastSyncInfo.action || '없음'}</p>
                    
                    <h3>💿 백업 정보</h3>
                    <p><strong>백업 시간:</strong> ${backupInfo.lastSync ? new Date(backupInfo.lastSync).toLocaleString('ko-KR') : '없음'}</p>
                    <p><strong>백업 소스:</strong> ${backupInfo.source || '없음'}</p>
                    <p><strong>SHA:</strong> ${backupInfo.sha ? backupInfo.sha.substring(0, 8) : '없음'}</p>
                    
                    <h3>📋 카드 목록 (최근 5개)</h3>
                    <div class="card-list">
                        ${this.cards.slice(0, 5).map(card => `
                            <p>• ${card.customerName} (${card.salesperson}) - ${this.formatDate(card.consultationDate)}</p>
                        `).join('') || '<p>카드 없음</p>'}
                    </div>
                    
                    <div class="debug-actions">
                        <button class="btn btn-primary" onclick="consultationManager.forceFullSync()">
                            🔄 강제 전체 동기화
                        </button>
                        <button class="btn btn-primary" onclick="consultationManager.normalizeImageUrls()">
                            �️ 로이미지 URL 정규화
                        </button>
                        <button class="btn btn-secondary" onclick="consultationManager.clearLocalData()">
                            �️ 로그컬 데이터 초기화
                        </button>
                        <button class="btn btn-secondary" onclick="consultationManager.exportDebugLog()">
                            📥 디버그 로그 다운로드
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(debugModal);
        debugModal.style.display = 'block';
    }

    async forceFullSync() {
        if (!confirm('강제 전체 동기화를 실행하시겠습니까?\n\nGitHub의 데이터를 기준으로 모든 브라우저를 동기화합니다.')) {
            return;
        }

        try {
            this.showMessage('강제 동기화 시작...', 'info');
            
            // 로컬 데이터 완전 초기화
            localStorage.removeItem('consultationCards');
            localStorage.removeItem('consultationCardsBackup');
            localStorage.removeItem('lastSyncInfo');
            
            // GitHub에서 강제로 다시 로드
            await this.loadCardsFromGitHub(true);
            
            // 화면 새로고침
            if (this.currentSection === 'search') {
                this.loadAllCards();
            }
            
            this.showMessage(`강제 동기화 완료: ${this.cards.length}개 카드`, 'success');
            
            // 디버그 모달 닫기
            document.querySelector('.debug-modal')?.remove();
            
        } catch (error) {
            console.error('강제 동기화 실패:', error);
            this.showMessage('강제 동기화 실패: ' + error.message, 'error');
        }
    }

    async normalizeImageUrls() {
        if (!confirm('이미지 URL을 정규화하시겠습니까?\n\n모든 카드의 이미지를 GitHub URL로 통일합니다.')) {
            return;
        }

        try {
            this.showMessage('이미지 URL 정규화 중...', 'info');
            
            let normalizedCount = 0;
            const updatedCards = this.cards.map(card => {
                if (card.githubImageUrl && card.imageData !== card.githubImageUrl) {
                    normalizedCount++;
                    console.log(`정규화: ${card.customerName} - ${card.githubImageUrl}`);
                    return {
                        ...card,
                        imageData: card.githubImageUrl,
                        imageSource: 'github'
                    };
                }
                return card;
            });

            this.cards = updatedCards;
            
            // 정규화된 데이터를 모든 저장소에 저장
            localStorage.setItem('consultationCards', JSON.stringify(this.cards));
            await this.saveCardsToGitHub();
            
            this.showMessage(`이미지 URL 정규화 완료: ${normalizedCount}개 카드 업데이트`, 'success');
            
            // 화면 새로고침
            if (this.currentSection === 'search') {
                this.loadAllCards();
            }
            
            // 디버그 모달 닫기
            document.querySelector('.debug-modal')?.remove();
            
        } catch (error) {
            console.error('이미지 URL 정규화 실패:', error);
            this.showMessage('이미지 URL 정규화 실패: ' + error.message, 'error');
        }
    }

    clearLocalData() {
        if (!confirm('로컬 데이터를 초기화하시겠습니까?\n\n이 작업은 현재 브라우저의 로컬 데이터만 삭제하며, GitHub 데이터는 유지됩니다.')) {
            return;
        }

        localStorage.removeItem('consultationCards');
        localStorage.removeItem('consultationCardsBackup');
        localStorage.removeItem('lastSyncInfo');
        
        this.cards = [];
        
        if (this.currentSection === 'search') {
            this.loadAllCards();
        }
        
        this.showMessage('로컬 데이터가 초기화되었습니다. 동기화 버튼을 눌러 GitHub에서 데이터를 다시 가져오세요.', 'info');
        
        // 디버그 모달 닫기
        document.querySelector('.debug-modal')?.remove();
    }

    getImageSourceStats() {
        const stats = { github: 0, base64: 0, unknown: 0 };
        this.cards.forEach(card => {
            if (card.imageSource === 'github') stats.github++;
            else if (card.imageSource === 'base64') stats.base64++;
            else stats.unknown++;
        });
        return stats;
    }

    exportDebugLog() {
        const localCards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
        const debugData = {
            timestamp: new Date().toISOString(),
            browser: navigator.userAgent,
            memoryCards: this.cards.length,
            localStorageCards: localCards.length,
            githubConfig: JSON.parse(localStorage.getItem('githubConfig') || '{}'),
            lastSyncInfo: JSON.parse(localStorage.getItem('lastSyncInfo') || '{}'),
            backupInfo: JSON.parse(localStorage.getItem('consultationCardsBackup') || '{}'),
            imageSourceStats: this.getImageSourceStats(),
            cards: this.cards.map(card => ({
                id: card.id,
                customerName: card.customerName,
                salesperson: card.salesperson,
                consultationDate: card.consultationDate,
                uploadDate: card.uploadDate,
                imageSource: card.imageSource,
                hasGithubUrl: !!card.githubImageUrl,
                imageDataType: card.imageData ? (card.imageData.startsWith('data:') ? 'base64' : 'url') : 'none'
            })),
            localStorageCards: localCards.map(card => ({
                id: card.id,
                customerName: card.customerName,
                imageSource: card.imageSource,
                hasGithubUrl: !!card.githubImageUrl,
                imageDataType: card.imageData ? (card.imageData.startsWith('data:') ? 'base64' : 'url') : 'none'
            }))
        };

        const dataStr = JSON.stringify(debugData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `debug-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        link.click();
        
        this.showMessage('디버그 로그가 다운로드되었습니다.', 'success');
    }

    async uploadImageToGitHub(imageData, fileName) {
        // GitHub 설정 확인
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (!savedConfig.owner || !savedConfig.repo || !savedConfig.token) {
            this.showMessage('GitHub 설정을 먼저 완료해주세요.', 'error');
            return null;
        }

        this.githubConfig = savedConfig;

        try {
            // Base64 데이터에서 헤더 제거
            const base64Data = imageData.split(',')[1];
            const filePath = `${this.imageFolder}/${fileName}`;

            // GitHub API를 통해 파일 업로드
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Add consultation card image: ${fileName}`,
                    content: base64Data,
                    branch: this.githubConfig.branch
                })
            });

            if (response.ok) {
                const result = await response.json();
                // GitHub Pages URL 생성
                const githubPagesUrl = `https://${this.githubConfig.owner}.github.io/${this.githubConfig.repo}/${filePath}`;
                console.log('Image uploaded successfully:', githubPagesUrl);
                return githubPagesUrl;
            } else {
                const error = await response.json();
                throw new Error(`GitHub API Error: ${error.message}`);
            }
        } catch (error) {
            console.error('GitHub upload failed:', error);
            this.showMessage(`이미지 업로드 실패: ${error.message}`, 'error');
            return null;
        }
    }

    async syncData() {
        this.showMessage('데이터 동기화 중...', 'info');
        
        try {
            // 현재 브라우저 정보 로깅
            const browserInfo = navigator.userAgent.split(' ').pop();
            console.log(`=== 동기화 시작 (${browserInfo}) ===`);
            
            // 1단계: 현재 상태 백업
            const currentCards = [...this.cards];
            const currentCount = currentCards.length;
            console.log('현재 메모리 카드 수:', currentCount);
            
            // 2단계: 로컬 스토리지 상태 확인
            const localStorageCards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
            console.log('로컬 스토리지 카드 수:', localStorageCards.length);
            
            // 3단계: GitHub에서 강제로 최신 데이터 가져오기
            console.log('GitHub에서 최신 데이터 가져오는 중...');
            await this.loadCardsFromGitHub(true); // 강제 새로고침
            const githubCount = this.cards.length;
            console.log('GitHub 카드 수:', githubCount);
            
            // 4단계: 데이터 일관성 검증 및 병합
            let finalCards = [];
            let syncAction = '';
            
            // 모든 데이터 소스를 고려한 스마트 병합
            const allDataSources = [
                { source: 'current', cards: currentCards, count: currentCount },
                { source: 'localStorage', cards: localStorageCards, count: localStorageCards.length },
                { source: 'github', cards: this.cards, count: githubCount }
            ];
            
            console.log('데이터 소스별 카드 수:', allDataSources.map(s => `${s.source}: ${s.count}`).join(', '));
            
            // 가장 많은 데이터를 가진 소스를 기준으로 병합
            const maxCount = Math.max(...allDataSources.map(s => s.count));
            const primarySource = allDataSources.find(s => s.count === maxCount);
            
            console.log('기준 데이터 소스:', primarySource.source, '(', primarySource.count, '개)');
            
            if (maxCount === 0) {
                // 모든 소스가 비어있음
                finalCards = [];
                syncAction = '빈 데이터로 초기화';
            } else {
                // 모든 소스의 데이터를 병합 (중복 제거)
                const mergedMap = new Map();
                
                allDataSources.forEach(source => {
                    if (Array.isArray(source.cards)) {
                        source.cards.forEach(card => {
                            if (card && card.id) {
                                const existingCard = mergedMap.get(card.id);
                                if (!existingCard || new Date(card.uploadDate) > new Date(existingCard.uploadDate)) {
                                    mergedMap.set(card.id, { ...card, syncSource: source.source });
                                }
                            }
                        });
                    }
                });
                
                finalCards = Array.from(mergedMap.values());
                syncAction = `${finalCards.length}개 카드 병합 완료`;
                
                console.log('병합 결과:', finalCards.length, '개 카드');
                console.log('카드별 소스:', finalCards.map(c => `${c.customerName}(${c.syncSource})`).join(', '));
            }
            
            // 5단계: 최종 데이터 적용
            this.cards = finalCards;
            
            // 6단계: 모든 저장소에 동기화
            console.log('모든 저장소에 동기화 중...');
            
            // 로컬 스토리지 업데이트
            localStorage.setItem('consultationCards', JSON.stringify(this.cards));
            
            // GitHub 업데이트 (항상 최신 상태로 유지)
            await this.saveCardsToGitHub();
            
            // 백업 정보 저장
            const syncInfo = {
                timestamp: new Date().toISOString(),
                browser: browserInfo,
                cardCount: this.cards.length,
                action: syncAction,
                sources: allDataSources.map(s => ({ source: s.source, count: s.count }))
            };
            localStorage.setItem('lastSyncInfo', JSON.stringify(syncInfo));
            
            console.log('=== 동기화 완료 ===');
            console.log('최종 카드 수:', this.cards.length);
            
            // 7단계: UI 업데이트
            if (this.currentSection === 'search') {
                this.loadAllCards();
            }
            
            this.showMessage(`동기화 완료: ${this.cards.length}개 카드 (${new Date().toLocaleTimeString()})`, 'success');
            
        } catch (error) {
            console.error('동기화 실패:', error);
            this.showMessage('동기화 실패: ' + error.message, 'error');
            
            // 실패 시 로컬 데이터라도 복구
            const fallbackCards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
            if (fallbackCards.length > 0) {
                this.cards = fallbackCards;
                this.showMessage(`로컬 백업 데이터 복구: ${this.cards.length}개 카드`, 'info');
                if (this.currentSection === 'search') {
                    this.loadAllCards();
                }
            }
        }
    }

    mergeCardData(localCards, remoteCards) {
        const merged = new Map();
        
        // 원격 데이터 먼저 추가
        remoteCards.forEach(card => {
            merged.set(card.id, card);
        });
        
        // 로컬 데이터로 덮어쓰기 (더 최신이면)
        localCards.forEach(localCard => {
            const remoteCard = merged.get(localCard.id);
            if (!remoteCard || new Date(localCard.uploadDate) > new Date(remoteCard.uploadDate)) {
                merged.set(localCard.id, localCard);
            }
        });
        
        return Array.from(merged.values());
    }

    getLatestUploadDate(cards) {
        if (cards.length === 0) return new Date(0);
        return cards.reduce((latest, card) => {
            const cardDate = new Date(card.uploadDate);
            return cardDate > latest ? cardDate : latest;
        }, new Date(0));
    }

    // 데이터 내보내기/가져오기 기능
    exportData() {
        const dataStr = JSON.stringify(this.cards, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `consultation_cards_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedCards = JSON.parse(e.target.result);
                if (Array.isArray(importedCards)) {
                    this.cards = importedCards;
                    this.saveCards();
                    this.showMessage('데이터를 성공적으로 가져왔습니다.', 'success');
                    if (this.currentSection === 'search') {
                        this.loadAllCards();
                    }
                }
            } catch (error) {
                this.showMessage('파일 형식이 올바르지 않습니다.', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// 전역 인스턴스 생성
const consultationManager = new ConsultationCardManager();

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case '1':
                e.preventDefault();
                consultationManager.showSection('upload');
                break;
            case '2':
                e.preventDefault();
                consultationManager.showSection('search');
                break;
            case 'f':
                if (consultationManager.currentSection === 'search') {
                    e.preventDefault();
                    document.getElementById('searchCustomer').focus();
                }
                break;
        }
    }
    
    if (e.key === 'Escape') {
        consultationManager.closeModal();
    }
    
    // 모달이 열려있을 때 줌 관련 키보드 단축키
    if (document.getElementById('imageModal').style.display === 'block') {
        switch(e.key) {
            case '+':
            case '=':
                e.preventDefault();
                if (consultationManager.zoomState.isZoomed) {
                    consultationManager.setImageScale(Math.min(5, consultationManager.zoomState.scale * 1.2));
                } else {
                    consultationManager.toggleImageZoom();
                }
                break;
            case '-':
                e.preventDefault();
                if (consultationManager.zoomState.isZoomed) {
                    const newScale = Math.max(1, consultationManager.zoomState.scale * 0.8);
                    consultationManager.setImageScale(newScale);
                    if (newScale === 1) {
                        consultationManager.resetImageZoom();
                    }
                }
                break;
            case '0':
                e.preventDefault();
                consultationManager.resetImageZoom();
                break;
            case 'ArrowLeft':
                if (consultationManager.zoomState.isZoomed) {
                    e.preventDefault();
                    consultationManager.moveImage(50, 0);
                }
                break;
            case 'ArrowRight':
                if (consultationManager.zoomState.isZoomed) {
                    e.preventDefault();
                    consultationManager.moveImage(-50, 0);
                }
                break;
            case 'ArrowUp':
                if (consultationManager.zoomState.isZoomed) {
                    e.preventDefault();
                    consultationManager.moveImage(0, 50);
                }
                break;
            case 'ArrowDown':
                if (consultationManager.zoomState.isZoomed) {
                    e.preventDefault();
                    consultationManager.moveImage(0, -50);
                }
                break;
        }
    }
});