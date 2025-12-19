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
        await this.loadCardsFromGitHub();
        this.loadSalespersonFilter();
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
        // 5분마다 자동 동기화
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            try {
                await this.loadCardsFromGitHub();
                console.log('Auto sync completed');
            } catch (error) {
                console.error('Auto sync failed:', error);
            }
        }, 5 * 60 * 1000); // 5분
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
        document.getElementById('searchCustomer').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCards();
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
        document.getElementById('syncBtn').addEventListener('click', () => this.syncData());
        
        // 필터 섹션 토글
        this.setupFilterToggle();
        
        // 빠른 필터 버튼들
        this.setupQuickFilters();
        this.setupSalespersonFilters();
        this.setupPurchaseFilters();
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
            this.loadAllCards();
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
                purchaseCompleted: formData.get('purchaseCompleted') === 'on', // 구매 완료 상태
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
                cardData.imageData = githubImageUrl; // GitHub URL로 교체
            }
            
            this.showMessage('상담 카드가 성공적으로 업로드되었습니다.', 'success');
            event.target.reset();
            this.setDefaultDate();
            this.loadSalespersonFilter();

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

    async loadCardsFromGitHub() {
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (!savedConfig.owner || !savedConfig.repo || !savedConfig.token) {
            // GitHub 설정이 없으면 로컬 데이터 사용
            this.cards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
            return;
        }

        this.githubConfig = savedConfig;

        try {
            this.showMessage('데이터를 불러오는 중...', 'info');
            
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}`, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                // UTF-8 Base64 디코딩
                const binaryString = atob(data.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const content = new TextDecoder('utf-8').decode(bytes);
                this.cards = JSON.parse(content);
                
                // 로컬에도 백업
                localStorage.setItem('consultationCards', JSON.stringify(this.cards));
                
                this.showMessage(`${this.cards.length}개의 상담 카드를 불러왔습니다.`, 'success');
            } else if (response.status === 404) {
                // 파일이 없으면 빈 배열로 시작
                this.cards = [];
                await this.saveCardsToGitHub(); // 빈 파일 생성
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Failed to load cards from GitHub:', error);
            // GitHub에서 불러오기 실패 시 로컬 데이터 사용
            this.cards = JSON.parse(localStorage.getItem('consultationCards') || '[]');
            this.showMessage('로컬 데이터를 사용합니다. GitHub 설정을 확인해주세요.', 'info');
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

    loadSalespersonFilter() {
        // 고정된 판매자 목록 사용
        const salespersons = ['이호만 점장', '김승진 실장', '오희정 실장'];
        const select = document.getElementById('salespersonFilter');
        
        // 기존 옵션 제거 (첫 번째 옵션 제외)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        salespersons.forEach(person => {
            const option = document.createElement('option');
            option.value = person;
            option.textContent = person;
            select.appendChild(option);
        });
    }

    searchCards() {
        const searchTerm = document.getElementById('searchCustomer').value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.loadAllCards();
            return;
        }

        const filteredCards = this.cards.filter(card => 
            card.customerName.toLowerCase().includes(searchTerm)
        );

        this.displayCards(filteredCards);
    }

    applyFilters() {
        const salesperson = document.getElementById('salespersonFilter').value;
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        const searchTerm = document.getElementById('searchCustomer').value.toLowerCase().trim();

        let filteredCards = this.cards;

        if (searchTerm) {
            filteredCards = filteredCards.filter(card => 
                card.customerName.toLowerCase().includes(searchTerm)
            );
        }

        if (salesperson) {
            filteredCards = filteredCards.filter(card => card.salesperson === salesperson);
        }

        if (dateFrom) {
            filteredCards = filteredCards.filter(card => card.consultationDate >= dateFrom);
        }

        if (dateTo) {
            filteredCards = filteredCards.filter(card => card.consultationDate <= dateTo);
        }

        this.displayCards(filteredCards);
        
        // 필터 적용 메시지
        const filterCount = filteredCards.length;
        const totalCount = this.cards.length;
        if (filterCount < totalCount) {
            this.showMessage(`${totalCount}개 중 ${filterCount}개 카드가 필터 조건에 맞습니다.`, 'info');
        }
        

    }

    resetFilters() {
        // 모든 필터 초기화
        document.getElementById('searchCustomer').value = '';
        document.getElementById('salespersonFilter').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        
        // 빠른 필터 버튼들 초기화
        document.querySelectorAll('.quick-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.salesperson-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.purchase-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        
        // 기본 버튼들 활성화
        document.querySelector('.quick-filter-btn[data-period="all"]')?.classList.add('active');
        document.querySelector('.salesperson-filter-btn[data-salesperson=""]')?.classList.add('active');
        document.querySelector('.purchase-filter-btn[data-status=""]')?.classList.add('active');
        
        // 전체 카드 표시
        this.loadAllCards();
        this.showMessage('모든 필터가 초기화되었습니다.', 'info');
    }

    setupFilterToggle() {
        const filterTitle = document.querySelector('.filter-title');
        const filterGroup = document.querySelector('.filter-group');
        const filterActions = document.querySelector('.filter-actions');
        
        // 초기 상태: 접힘
        let isExpanded = false;
        filterGroup.style.display = 'none';
        filterActions.style.display = 'none';
        
        filterTitle.addEventListener('click', () => {
            isExpanded = !isExpanded;
            
            if (isExpanded) {
                filterGroup.style.display = 'grid';
                filterActions.style.display = 'flex';
                filterTitle.innerHTML = '🔼 상세 필터';
            } else {
                filterGroup.style.display = 'none';
                filterActions.style.display = 'none';
                filterTitle.innerHTML = '🔽 상세 필터';
            }
        });
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
        const today = new Date();
        let dateFrom = '';
        let dateTo = '';

        switch(period) {
            case 'week':
                // 금주 (월요일부터 일요일까지)
                const weekStart = new Date(today);
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 1-요일
                weekStart.setDate(today.getDate() + mondayOffset);
                
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                dateFrom = weekStart.toISOString().split('T')[0];
                dateTo = weekEnd.toISOString().split('T')[0];
                break;
            case 'month':
                // 당월 (이번 달 1일부터 마지막 날까지)
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                dateFrom = monthStart.toISOString().split('T')[0];
                dateTo = monthEnd.toISOString().split('T')[0];
                break;
            case 'lastMonth':
                // 지난 달 (지난 달 1일부터 마지막 날까지)
                const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                dateFrom = lastMonthStart.toISOString().split('T')[0];
                dateTo = lastMonthEnd.toISOString().split('T')[0];
                break;
            case 'all':
                dateFrom = dateTo = '';
                break;
        }

        // 날짜 필터 설정
        document.getElementById('dateFrom').value = dateFrom;
        document.getElementById('dateTo').value = dateTo;
        
        // 필터 적용
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
        // 판매자 필터 설정
        document.getElementById('salespersonFilter').value = salesperson;
        
        // 필터 적용
        this.applyFilters();
        
        // 메시지 표시
        const message = salesperson ? `${salesperson} 필터가 적용되었습니다.` : '전체 판매자 필터가 적용되었습니다.';
        this.showMessage(message, 'info');
    }

    setupPurchaseFilters() {
        const purchaseFilterBtns = document.querySelectorAll('.purchase-filter-btn');
        
        purchaseFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 모든 버튼에서 active 클래스 제거
                purchaseFilterBtns.forEach(b => b.classList.remove('active'));
                // 클릭된 버튼에 active 클래스 추가
                btn.classList.add('active');
                
                const status = btn.dataset.status;
                this.applyPurchaseFilter(status);
            });
        });
    }

    applyPurchaseFilter(status) {
        let filteredCards = this.cards;

        // 기존 필터들 적용
        const salesperson = document.getElementById('salespersonFilter').value;
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        const searchTerm = document.getElementById('searchCustomer').value.toLowerCase().trim();

        if (searchTerm) {
            filteredCards = filteredCards.filter(card => 
                card.customerName.toLowerCase().includes(searchTerm)
            );
        }

        if (salesperson) {
            filteredCards = filteredCards.filter(card => card.salesperson === salesperson);
        }

        if (dateFrom) {
            filteredCards = filteredCards.filter(card => card.consultationDate >= dateFrom);
        }

        if (dateTo) {
            filteredCards = filteredCards.filter(card => card.consultationDate <= dateTo);
        }

        // 구매 상태 필터 적용
        if (status === 'completed') {
            filteredCards = filteredCards.filter(card => card.purchaseCompleted === true);
        } else if (status === 'pending') {
            filteredCards = filteredCards.filter(card => card.purchaseCompleted !== true);
        }

        this.displayCards(filteredCards);
        
        // 메시지 표시
        const messages = {
            completed: '구매완료',
            pending: '상담중',
            '': '전체 상태'
        };
        this.showMessage(`${messages[status]} 필터가 적용되었습니다.`, 'info');
    }



    loadAllCards() {
        this.displayCards(this.cards);
    }

    displayCards(cards) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (cards.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">📭 검색 결과가 없습니다.</div>';
            return;
        }

        // 최신 순으로 정렬
        const sortedCards = cards.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        resultsContainer.innerHTML = sortedCards.map(card => `
            <div class="card-item text-only ${card.purchaseCompleted ? 'purchased' : ''}" ontouchstart="">
                <button class="delete-btn" onclick="event.stopPropagation(); consultationManager.confirmDelete('${card.id}')" title="카드 삭제">
                    🗑️
                </button>
                <button class="purchase-toggle-btn ${card.purchaseCompleted ? 'completed' : ''}" 
                        onclick="event.stopPropagation(); consultationManager.togglePurchaseStatus('${card.id}')" 
                        title="${card.purchaseCompleted ? '구매 완료 취소' : '구매 완료 표시'}">
                    ${card.purchaseCompleted ? '✅' : '⭕'}
                </button>
                <div class="card-info" onclick="consultationManager.openFullscreenModal('${card.id}')">
                    <h3>👤 ${card.customerName} ${card.purchaseCompleted ? '<span class="purchase-badge">구매완료</span>' : ''}</h3>
                    <p class="salesperson">👨‍💼 ${card.salesperson}</p>
                    <p class="date">📅 ${this.formatDate(card.consultationDate)}</p>
                    <p class="upload-date">⏰ ${this.formatDateTime(card.uploadDate)}</p>
                    ${card.notes ? `<p class="notes">📝 ${this.truncateText(card.notes, 80)}</p>` : ''}
                    <p class="view-hint">👆 클릭하여 이미지 보기</p>
                </div>
            </div>
        `).join('');
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    async togglePurchaseStatus(cardId) {
        try {
            const cardIndex = this.cards.findIndex(c => c.id === cardId);
            if (cardIndex === -1) {
                this.showMessage('카드를 찾을 수 없습니다.', 'error');
                return;
            }

            // 구매 완료 상태 토글
            this.cards[cardIndex].purchaseCompleted = !this.cards[cardIndex].purchaseCompleted;
            
            // 데이터 저장
            await this.saveCards();
            
            // 화면 업데이트
            if (this.currentSection === 'search') {
                this.loadAllCards();
            }
            
            const status = this.cards[cardIndex].purchaseCompleted ? '구매 완료로' : '상담 중으로';
            this.showMessage(`${this.cards[cardIndex].customerName} 고객의 상태가 ${status} 변경되었습니다.`, 'success');
            
        } catch (error) {
            console.error('Toggle purchase status error:', error);
            this.showMessage('상태 변경 중 오류가 발생했습니다.', 'error');
        }
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
            this.loadSalespersonFilter();

            // 확인 모달 닫기
            this.closeDeleteConfirm();
            
            // 이미지 모달도 닫기 (열려있는 경우)
            this.closeModal();

            this.showMessage('상담 카드가 삭제되었습니다.', 'success');

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
                <h3>${card.customerName} - 상담 카드 ${card.purchaseCompleted ? '<span class="purchase-badge">구매완료</span>' : ''}</h3>
                <div class="modal-actions">
                    <button class="modal-purchase-btn ${card.purchaseCompleted ? 'completed' : ''}" 
                            onclick="consultationManager.togglePurchaseStatus('${card.id}')" 
                            title="${card.purchaseCompleted ? '구매 완료 취소' : '구매 완료 표시'}">
                        ${card.purchaseCompleted ? '✅ 구매완료' : '⭕ 구매대기'}
                    </button>
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
                        <h3>${card.customerName} ${card.purchaseCompleted ? '<span class="purchase-badge">구매완료</span>' : ''}</h3>
                        <p>${card.salesperson} | ${this.formatDate(card.consultationDate)}</p>
                    </div>
                    <div class="fullscreen-actions">
                        <button class="fullscreen-purchase-btn ${card.purchaseCompleted ? 'completed' : ''}" 
                                onclick="consultationManager.togglePurchaseStatusAndRefresh('${card.id}')" 
                                title="${card.purchaseCompleted ? '구매 완료 취소' : '구매 완료 표시'}">
                            ${card.purchaseCompleted ? '✅' : '⭕'}
                        </button>
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

    async togglePurchaseStatusAndRefresh(cardId) {
        await this.togglePurchaseStatus(cardId);
        
        // 전체 화면 모달 새로고침
        this.closeFullscreenModal();
        setTimeout(() => {
            this.openFullscreenModal(cardId);
        }, 100);
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
            await this.loadCardsFromGitHub();
            this.loadSalespersonFilter();
            
            if (this.currentSection === 'search') {
                this.loadAllCards();
            }
            
            this.showMessage('데이터 동기화가 완료되었습니다.', 'success');
        } catch (error) {
            console.error('Sync failed:', error);
            this.showMessage('동기화 실패: ' + error.message, 'error');
        }
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
                    this.loadSalespersonFilter();
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