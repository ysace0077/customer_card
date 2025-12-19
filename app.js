class ConsultationCardManager {
    constructor() {
        this.cards = JSON.parse(localStorage.getItem('consultationCards')) || [];
        this.currentSection = 'upload';
        this.imageFolder = 'images'; // GitHub 이미지 저장 폴더명
        this.githubConfig = {
            owner: '', // GitHub 사용자명 또는 조직명 (설정 필요)
            repo: '', // 저장소명 (설정 필요)
            token: '', // GitHub Personal Access Token (설정 필요)
            branch: 'main' // 기본 브랜치
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSalespersonFilter();
        this.setDefaultDate();
        this.setupMobileOptimizations();
        this.loadGithubConfig();
    }

    loadGithubConfig() {
        const savedConfig = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        if (savedConfig.owner && savedConfig.repo && savedConfig.token) {
            this.githubConfig = savedConfig;
            this.updateGithubStatus(true);
        } else {
            this.updateGithubStatus(false);
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
        
        // 이미지 클릭으로 확대 모드 진입
        modalImage.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleImageZoom();
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
            } else if (e.touches.length === 1 && this.zoomState.isZoomed) {
                this.zoomState.isDragging = true;
                this.zoomState.lastX = e.touches[0].clientX;
                this.zoomState.lastY = e.touches[0].clientY;
            }
        });

        modalImage.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && this.zoomState.isZoomed) {
                e.preventDefault();
                const currentDistance = this.getTouchDistance(e.touches);
                const scale = initialScale * (currentDistance / initialDistance);
                this.setImageScale(Math.max(1, Math.min(5, scale)));
            } else if (e.touches.length === 1 && this.zoomState.isDragging && this.zoomState.isZoomed) {
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
        let controls = document.getElementById('zoomControls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'zoomControls';
            controls.className = 'zoom-controls';
            controls.innerHTML = `
                <button class="zoom-btn" id="zoomIn">🔍+</button>
                <button class="zoom-btn" id="zoomOut">🔍-</button>
                <button class="zoom-btn" id="zoomReset">⌂</button>
                <div class="zoom-hint">클릭: 확대/축소 | 드래그: 이동 | 휠/핀치: 줌 | 키보드: +/-/0/방향키</div>
            `;
            document.querySelector('.modal-content').appendChild(controls);

            // 줌 컨트롤 이벤트
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
            this.saveCards();
            
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

    saveCards() {
        localStorage.setItem('consultationCards', JSON.stringify(this.cards));
    }

    loadSalespersonFilter() {
        const salespersons = [...new Set(this.cards.map(card => card.salesperson))];
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
            <div class="card-item text-only" ontouchstart="" onclick="consultationManager.openModal('${card.id}')">
                <div class="card-info">
                    <h3>👤 ${card.customerName}</h3>
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
        
        modalInfo.innerHTML = `
            <h3>${card.customerName} - 상담 카드</h3>
            <p><strong>판매자:</strong> ${card.salesperson}</p>
            <p><strong>상담 날짜:</strong> ${this.formatDate(card.consultationDate)}</p>
            <p><strong>업로드 날짜:</strong> ${this.formatDateTime(card.uploadDate)}</p>
            <p><strong>파일명:</strong> ${card.fileName}</p>
            <p><strong>파일 크기:</strong> ${this.formatFileSize(card.fileSize)}</p>
            ${card.originalWidth && card.originalHeight ? 
                `<p><strong>이미지 해상도:</strong> ${card.originalWidth} × ${card.originalHeight}</p>` : ''}
            ${card.notes ? `<p><strong>메모:</strong> ${card.notes}</p>` : ''}
            <p class="zoom-instruction">💡 이미지를 클릭하면 확대할 수 있습니다</p>
        `;

        modal.style.display = 'block';
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