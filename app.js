// 고객 상담 카드 관리 시스템 - GitHub 직접 연동 버전
class ConsultationCardManager {
    constructor() {
        this.cards = [];
        this.currentSection = 'upload';
        this.currentImageFile = null; // 현재 선택된 이미지 파일
        
        // GitHub 설정
        this.githubConfig = {
            owner: '',
            repo: '',
            token: '',
            branch: 'main'
        };
        
        // 데이터 파일 경로
        this.dataFile = 'data/consultation_cards.json';
        this.imageFolder = 'images';
        
        this.init();
    }

    async init() {
        console.log('앱 초기화 시작 - GitHub 직접 연동 모드');
        this.bindEvents();
        this.setDefaultDate();
        this.setupMobileOptimizations();
        
        // GitHub 설정 로드 및 초기 데이터 로드
        await this.loadGithubConfig();
        console.log('앱 초기화 완료');
    }

    // GitHub 설정 로드
    async loadGithubConfig() {
        const saved = localStorage.getItem('githubConfig');
        if (saved) {
            try {
                this.githubConfig = JSON.parse(saved);
                console.log('GitHub 설정 로드됨:', this.githubConfig.owner + '/' + this.githubConfig.repo);
                
                // GitHub 설정이 있으면 데이터 로드 시도
                if (this.isGithubConfigured()) {
                    try {
                        await this.loadCardsFromGithub();
                        this.showMessage(`GitHub 연결 성공! ${this.cards.length}개 카드 로드됨`, 'success');
                    } catch (error) {
                        console.error('초기 데이터 로드 실패:', error);
                        this.showMessage(`GitHub 연결됨, 데이터 로드 실패: ${error.message}`, 'error');
                    }
                } else {
                    this.showMessage('GitHub 설정을 완료해주세요.', 'info');
                }
            } catch (error) {
                console.error('GitHub 설정 파싱 오류:', error);
                localStorage.removeItem('githubConfig');
                this.showMessage('저장된 GitHub 설정이 손상되었습니다. 다시 설정해주세요.', 'error');
            }
        } else {
            this.showMessage('GitHub 설정이 필요합니다. ⚙️ 설정 버튼을 클릭하세요.', 'info');
        }
    }

    // GitHub 설정 확인
    isGithubConfigured() {
        return this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token;
    }

    // 모바일 최적화 설정
    setupMobileOptimizations() {
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

        // 모바일에서 파일 선택 시 문서 스캔 모드로 기본 설정
        const fileInput = document.getElementById('cardImage');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 문서 스캔에 최적화된 설정
            fileInput.setAttribute('capture', 'environment');
            fileInput.setAttribute('accept', 'image/jpeg,image/jpg');
            
            // 파일 입력 클릭 시 문서 스캔 모드 안내
            fileInput.addEventListener('click', () => {
                if (this.isIOSDevice()) {
                    setTimeout(() => {
                        this.showMessage('📄 카메라에서 문서 모드를 선택하세요. (iOS: 우측 하단 아이콘)', 'info');
                    }, 100);
                } else {
                    setTimeout(() => {
                        this.showMessage('📄 문서 스캔 모드로 카메라가 열립니다.', 'info');
                    }, 100);
                }
            });
        }
    }

    // 이벤트 바인딩
    bindEvents() {
        // 네비게이션
        document.getElementById('uploadBtn').addEventListener('click', () => this.showSection('upload'));
        document.getElementById('searchBtn').addEventListener('click', () => this.showSection('search'));
        document.getElementById('syncBtn').addEventListener('click', () => this.syncData());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

        // 업로드 폼
        document.getElementById('uploadForm').addEventListener('submit', (e) => this.handleUpload(e));
        document.getElementById('cardImage').addEventListener('change', (e) => this.validateFile(e));

        // 카메라 및 파일 입력 버튼들
        document.getElementById('cameraBtn').addEventListener('click', () => this.openCamera());
        document.getElementById('galleryBtn').addEventListener('click', () => this.openGallery());
        document.getElementById('retakeBtn').addEventListener('click', () => this.retakePhoto());
        document.getElementById('enhanceBtn').addEventListener('click', () => this.enhanceImage());

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
            }, 500);
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

        // 판매자 필터 버튼들
        this.setupSalespersonFilters();
        
        // 기간 필터 버튼들
        this.setupPeriodFilters();

        // 모달
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeAllModals());
        });
        document.getElementById('imageModal').addEventListener('click', (e) => {
            if (e.target.id === 'imageModal') this.closeAllModals();
        });
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') this.closeAllModals();
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // 설정
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        document.getElementById('cleanupStorageBtn').addEventListener('click', () => this.cleanupStorage());
    }

    // 섹션 전환
    showSection(section) {
        this.currentSection = section;
        
        document.getElementById('uploadSection').classList.toggle('hidden', section !== 'upload');
        document.getElementById('searchSection').classList.toggle('hidden', section !== 'search');
        
        document.getElementById('uploadBtn').classList.toggle('btn-primary', section === 'upload');
        document.getElementById('uploadBtn').classList.toggle('btn-secondary', section !== 'upload');
        document.getElementById('searchBtn').classList.toggle('btn-primary', section === 'search');
        document.getElementById('searchBtn').classList.toggle('btn-secondary', section !== 'search');

        if (section === 'search') {
            // 검색 탭 진입 시 GitHub에서 최신 데이터 로드
            this.loadSearchData();
        }
    }

    // 검색용 데이터 로드 (GitHub에서 직접)
    async loadSearchData() {
        if (!this.isGithubConfigured()) {
            this.showMessage('GitHub 설정을 먼저 완료해주세요.', 'error');
            this.displayCards([]);
            return;
        }

        this.showMessage('최신 데이터를 불러오는 중...', 'info');
        
        try {
            await this.loadCardsFromGithub();
            this.displayCards(this.cards);
            
            if (this.cards.length > 0) {
                this.showMessage(`${this.cards.length}개의 상담 카드를 불러왔습니다.`, 'success');
            } else {
                this.showMessage('저장된 상담 카드가 없습니다. 업로드 탭에서 카드를 추가해보세요.', 'info');
            }
        } catch (error) {
            console.error('검색 데이터 로드 오류:', error);
            this.showMessage(`데이터 로드 실패: ${error.message}`, 'error');
            this.displayCards([]);
        }
    }

    // 기본 날짜 설정
    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('consultationDate').value = today;
    }

    // 파일 검증
    validateFile(event) {
        const file = event.target.files[0];
        if (!file) return false;

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

        // 현재 이미지 파일 저장 및 미리보기 표시
        this.currentImageFile = file;
        this.updateImagePreview(file);
        
        // 모바일에서 이미지 개선 제안
        if (this.isMobileDevice()) {
            setTimeout(() => {
                this.showMessage('💡 이미지 개선 버튼으로 더 선명하게 만들 수 있습니다!', 'info');
            }, 1000);
        }

        return true;
    }

    // 업로드 처리 (GitHub 직접 저장)
    async handleUpload(event) {
        event.preventDefault();
        
        if (!this.isGithubConfigured()) {
            this.showMessage('GitHub 설정을 먼저 완료해주세요.', 'error');
            return;
        }
        
        const formData = new FormData(event.target);
        let file = this.currentImageFile || formData.get('cardImage');
        
        if (!file || !this.validateFile({target: {files: [file]}})) {
            this.showMessage('이미지를 선택해주세요.', 'error');
            return;
        }

        try {
            this.showMessage('업로드 중... (GitHub에 직접 저장)', 'info');
            
            // 파일명 생성
            const timestamp = Date.now();
            const customerName = formData.get('customerName').replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const salesperson = formData.get('salesperson').replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const date = formData.get('consultationDate').replace(/-/g, '');
            const fileName = `${date}_${salesperson}_${customerName}_${timestamp}.jpg`;

            // 이미지를 Base64로 변환
            const imageData = await this.fileToBase64(file);
            
            // GitHub에 이미지 업로드
            const githubImageUrl = await this.uploadImageToGithub(imageData, fileName);
            if (!githubImageUrl) {
                throw new Error('이미지 업로드에 실패했습니다.');
            }

            // 카드 데이터 생성
            const cardData = {
                id: timestamp.toString(),
                salesperson: formData.get('salesperson'),
                customerName: formData.get('customerName'),
                consultationDate: formData.get('consultationDate'),
                notes: formData.get('notes') || '',
                fileName: fileName,
                uploadDate: new Date().toISOString(),
                imageUrl: githubImageUrl
            };

            // 현재 카드 목록에 추가
            this.cards.push(cardData);
            
            // GitHub에 데이터 저장
            await this.saveCardsToGithub();
            
            this.showMessage('상담 카드가 GitHub에 저장되었습니다.', 'success');
            event.target.reset();
            this.setDefaultDate();
            
            // 미리보기 초기화
            document.getElementById('imagePreview').classList.add('hidden');
            this.currentImageFile = null;
            
        } catch (error) {
            console.error('업로드 오류:', error);
            this.showMessage(`업로드 실패: ${error.message}`, 'error');
        }
    }

    // 파일을 Base64로 변환
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // GitHub에 이미지 업로드
    async uploadImageToGithub(imageData, fileName) {
        try {
            const base64Data = imageData.split(',')[1];
            if (!base64Data) {
                throw new Error('이미지 데이터가 올바르지 않습니다.');
            }
            
            const path = `${this.imageFolder}/${fileName}`;
            
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'ConsultationCardManager/1.0'
                    },
                    body: JSON.stringify({
                        message: `Add consultation card image: ${fileName}`,
                        content: base64Data,
                        branch: this.githubConfig.branch
                    })
                }
            );

            if (response.ok) {
                const result = await response.json();
                const githubPagesUrl = `https://${this.githubConfig.owner}.github.io/${this.githubConfig.repo}/${path}`;
                console.log('이미지 업로드 성공:', githubPagesUrl);
                return githubPagesUrl;
            } else {
                const errorData = await response.text();
                console.error('GitHub 이미지 업로드 실패:', response.status, errorData);
                
                if (response.status === 401) {
                    throw new Error('GitHub 토큰이 유효하지 않습니다.');
                } else if (response.status === 403) {
                    throw new Error('GitHub API 권한이 부족합니다.');
                } else if (response.status === 422) {
                    throw new Error('이미지 파일이 너무 큽니다. 10MB 이하로 줄여주세요.');
                } else {
                    throw new Error(`이미지 업로드 실패 (${response.status}): ${response.statusText}`);
                }
            }
        } catch (error) {
            console.error('GitHub 이미지 업로드 오류:', error);
            
            // 네트워크 오류인 경우
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('네트워크 연결을 확인해주세요.');
            }
            
            throw error;
        }
    }

    // GitHub에서 카드 데이터 로드
    async loadCardsFromGithub() {
        if (!this.isGithubConfigured()) {
            console.log('GitHub 설정이 없습니다.');
            this.cards = [];
            return;
        }

        try {
            console.log('GitHub에서 데이터 로드 시작...');
            
            // 캐시 무시를 위한 타임스탬프 추가
            const cacheBuster = `?t=${Date.now()}`;
            const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}${cacheBuster}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'ConsultationCardManager/1.0'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('GitHub 응답 받음, SHA:', data.sha?.substring(0, 8));
                
                try {
                    // Base64 디코딩 (한글 깨짐 방지)
                    const base64Content = data.content.replace(/\s/g, '');
                    const binaryString = atob(base64Content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const decodedContent = new TextDecoder('utf-8').decode(bytes);
                    const githubCards = JSON.parse(decodedContent);
                    
                    if (Array.isArray(githubCards)) {
                        this.cards = githubCards;
                        console.log('GitHub에서 카드 로드 완료:', this.cards.length, '개');
                    } else {
                        console.warn('GitHub 데이터가 배열이 아닙니다. 빈 배열로 초기화합니다.');
                        this.cards = [];
                    }
                } catch (parseError) {
                    console.error('JSON 파싱 오류:', parseError);
                    console.log('원본 데이터:', data.content?.substring(0, 100));
                    this.cards = [];
                    throw new Error('데이터 파싱에 실패했습니다.');
                }
            } else if (response.status === 404) {
                console.log('데이터 파일이 없습니다. 새로 생성합니다.');
                this.cards = [];
                // 빈 데이터 파일 생성
                await this.saveCardsToGithub();
                console.log('빈 데이터 파일 생성 완료');
            } else if (response.status === 401) {
                throw new Error('GitHub 토큰이 유효하지 않습니다. 설정을 확인해주세요.');
            } else if (response.status === 403) {
                throw new Error('GitHub API 권한이 부족합니다. Contents 권한을 확인해주세요.');
            } else {
                const errorData = await response.text();
                console.error('GitHub API 오류:', response.status, errorData);
                throw new Error(`GitHub API 오류 (${response.status}): ${response.statusText}`);
            }
        } catch (error) {
            console.error('GitHub 데이터 로드 실패:', error);
            
            // 네트워크 오류인 경우
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('네트워크 연결을 확인해주세요.');
            }
            
            // 기타 오류
            throw error;
        }
    }

    // GitHub에 카드 데이터 저장
    async saveCardsToGithub() {
        if (!this.isGithubConfigured()) {
            throw new Error('GitHub 설정이 필요합니다.');
        }

        try {
            console.log('GitHub에 데이터 저장 시작...');
            
            // 현재 파일의 SHA 가져오기 (업데이트를 위해 필요)
            let sha = null;
            try {
                const getResponse = await fetch(
                    `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}`,
                    {
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'ConsultationCardManager/1.0'
                        }
                    }
                );
                
                if (getResponse.ok) {
                    const currentData = await getResponse.json();
                    sha = currentData.sha;
                    console.log('기존 파일 SHA:', sha?.substring(0, 8));
                } else if (getResponse.status !== 404) {
                    console.warn('파일 정보 가져오기 실패:', getResponse.status);
                }
            } catch (e) {
                console.log('기존 파일 확인 중 오류 (새 파일 생성):', e.message);
            }

            // 데이터를 JSON 문자열로 변환 후 UTF-8 Base64 인코딩 (한글 깨짐 방지)
            const jsonString = JSON.stringify(this.cards, null, 2);
            const utf8Bytes = new TextEncoder().encode(jsonString);
            const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
            const content = btoa(binaryString);

            const requestBody = {
                message: `Update consultation cards data - ${new Date().toISOString()}`,
                content: content,
                branch: this.githubConfig.branch
            };

            if (sha) {
                requestBody.sha = sha; // 기존 파일 업데이트
            }

            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'ConsultationCardManager/1.0'
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (response.ok) {
                const result = await response.json();
                console.log('GitHub에 데이터 저장 성공, 새 SHA:', result.content?.sha?.substring(0, 8));
            } else {
                const errorData = await response.text();
                console.error('GitHub 저장 실패:', response.status, errorData);
                
                if (response.status === 401) {
                    throw new Error('GitHub 토큰이 유효하지 않습니다.');
                } else if (response.status === 403) {
                    throw new Error('GitHub API 권한이 부족합니다.');
                } else if (response.status === 409) {
                    throw new Error('파일이 다른 곳에서 수정되었습니다. 동기화 후 다시 시도하세요.');
                } else {
                    throw new Error(`GitHub 저장 실패 (${response.status}): ${response.statusText}`);
                }
            }
        } catch (error) {
            console.error('GitHub 데이터 저장 실패:', error);
            throw error;
        }
    }

    // 동기화 (GitHub에서 최신 데이터 로드)
    async syncData() {
        if (!this.isGithubConfigured()) {
            this.showMessage('GitHub 설정을 먼저 완료해주세요.', 'error');
            return;
        }

        this.showMessage('GitHub에서 최신 데이터 동기화 중...', 'info');
        
        try {
            await this.loadCardsFromGithub();
            
            if (this.currentSection === 'search') {
                this.displayCards(this.cards);
            }
            
            this.showMessage(`동기화 완료: ${this.cards.length}개 카드`, 'success');
        } catch (error) {
            console.error('동기화 오류:', error);
            this.showMessage(`동기화 실패: ${error.message}`, 'error');
        }
    }

    // 판매자 필터 설정
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

    // 기간 필터 설정
    setupPeriodFilters() {
        const periodFilterBtns = document.querySelectorAll('.quick-filter-btn');
        
        periodFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 모든 버튼에서 active 클래스 제거
                periodFilterBtns.forEach(b => b.classList.remove('active'));
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

    // 검색 실행
    searchCards() {
        // 통합 필터 적용 (검색어 + 판매자 + 기간)
        this.applyFilters();
    }

    // 필터 적용
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

    // 기간 계산
    getPeriodDates(period) {
        const today = new Date();
        let dateFrom, dateTo;

        switch(period) {
            case 'week':
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const monday = new Date(today);
                monday.setDate(today.getDate() + mondayOffset);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                dateFrom = monday.toISOString().split('T')[0];
                dateTo = sunday.toISOString().split('T')[0];
                break;
            case 'month':
                dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                break;
            case 'lastMonth':
                dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                dateTo = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
                break;
        }

        return { dateFrom, dateTo };
    }

    // 필터 초기화
    resetFilters() {
        // 모든 필터 초기화
        document.getElementById('searchCustomer').value = '';
        
        // 판매자 필터 버튼들 초기화
        document.querySelectorAll('.salesperson-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.quick-filter-btn.active').forEach(btn => btn.classList.remove('active'));
        
        // 기본 버튼 활성화
        document.querySelector('.quick-filter-btn[data-period="all"]')?.classList.add('active');
        document.querySelector('.salesperson-filter-btn[data-salesperson=""]')?.classList.add('active');
        
        // 전체 카드 표시
        this.loadAllCards();
        this.showMessage('모든 필터가 초기화되었습니다.', 'info');
    }

    loadAllCards() {
        this.displayCards(this.cards);
    }

    // 카드 표시
    displayCards(cards) {
        const container = document.getElementById('searchResults');
        
        if (cards.length === 0) {
            container.innerHTML = '<div class="no-results">📭 검색 결과가 없습니다.</div>';
            return;
        }

        const sorted = cards.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        container.innerHTML = sorted.map(card => {
            // 안전한 HTML 생성 (한글 깨짐 방지)
            const customerName = this.escapeHtml(card.customerName || '');
            const salesperson = this.escapeHtml(card.salesperson || '');
            const notes = card.notes ? this.escapeHtml(this.truncateText(card.notes, 80)) : '';
            const consultationDate = this.formatDate(card.consultationDate);
            const uploadDate = this.formatDateTime(card.uploadDate);
            
            return `
                <div class="card-item text-only" ontouchstart="">
                    <button class="delete-btn" onclick="event.stopPropagation(); consultationManager.confirmDeleteCard('${card.id}')" title="카드 삭제">
                        🗑️
                    </button>
                    <div class="card-info" onclick="consultationManager.showCardDetail('${card.id}')">
                        <h3>👤 ${customerName}</h3>
                        <p class="salesperson">👨‍💼 ${salesperson}</p>
                        <p class="date">📅 ${consultationDate}</p>
                        <p class="upload-date">⏰ ${uploadDate}</p>
                        ${notes ? `<p class="notes">📝 ${notes}</p>` : ''}
                        <p class="view-hint">👆 클릭: 이미지 보기</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 삭제 확인 다이얼로그
    confirmDeleteCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        const customerName = this.escapeHtml(card.customerName);
        const salesperson = this.escapeHtml(card.salesperson);
        const fileName = card.fileName ? `\n파일: ${card.fileName}` : '';
        
        const confirmMessage = `상담 카드를 삭제하시겠습니까?\n\n고객: ${customerName}\n판매자: ${salesperson}${fileName}\n\n⚠️ GitHub에서 완전히 삭제됩니다.\n• 카드 데이터 삭제\n• 이미지 파일 삭제\n\n삭제된 데이터는 복구할 수 없습니다.`;
        
        if (confirm(confirmMessage)) {
            this.deleteCard(cardId);
        }
    }

    // 텍스트 자르기
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // 카드 상세 보기 (전체 화면 이미지 모달)
    showCardDetail(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) {
            console.error('카드를 찾을 수 없습니다:', cardId);
            return;
        }

        // 전체 화면 이미지 모달 생성
        this.createFullscreenImageModal(card);
    }

    // 전체 화면 이미지 모달 생성
    createFullscreenImageModal(card) {
        // 기존 모달 제거
        const existingModal = document.querySelector('.fullscreen-image-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 전체 화면 모달 생성
        const modal = document.createElement('div');
        modal.className = 'fullscreen-image-modal';
        modal.innerHTML = `
            <div class="fullscreen-header">
                <div class="fullscreen-info">
                    <h3>${this.escapeHtml(card.customerName)}</h3>
                    <p>${this.escapeHtml(card.salesperson)} | ${this.formatDate(card.consultationDate)}</p>
                </div>
                <button class="fullscreen-close" onclick="consultationManager.closeFullscreenModal()">
                    ✕
                </button>
            </div>
            <div class="fullscreen-image-container">
                <img src="${card.imageUrl || ''}" alt="${this.escapeHtml(card.customerName)} 상담 카드" class="fullscreen-image">
                <div class="zoom-hint">
                    <p>📱 두 손가락으로 확대/축소</p>
                    <p>🖱️ 마우스 휠로 확대/축소</p>
                    <p>👆 드래그로 이동</p>
                </div>
            </div>
            <div class="fullscreen-details">
                <div class="detail-item">
                    <strong>상담 날짜:</strong> ${this.formatDate(card.consultationDate)}
                </div>
                <div class="detail-item">
                    <strong>업로드:</strong> ${this.formatDateTime(card.uploadDate)}
                </div>
                ${card.notes ? `
                <div class="detail-item">
                    <strong>메모:</strong> ${this.escapeHtml(card.notes)}
                </div>
                ` : ''}
                <div class="detail-actions">
                    <button class="btn btn-danger" onclick="consultationManager.confirmDeleteCard('${card.id}')">
                        🗑️ 삭제
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 이미지 줌 기능 초기화
        this.initImageZoom(modal.querySelector('.fullscreen-image'));

        // 모달 표시 애니메이션
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // 이미지 로드 오류 처리
        const image = modal.querySelector('.fullscreen-image');
        image.onerror = () => {
            console.error('이미지 로드 실패:', card.imageUrl);
            image.src = 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
                    <rect fill="#ffebee" width="800" height="600"/>
                    <text x="400" y="280" text-anchor="middle" fill="#c62828" font-size="24" font-family="Arial">
                        이미지 로드 실패
                    </text>
                    <text x="400" y="320" text-anchor="middle" fill="#c62828" font-size="16" font-family="Arial">
                        GitHub Pages 설정을 확인하세요
                    </text>
                </svg>
            `);
        };

        // ESC 키로 닫기
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeFullscreenModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // 이미지 줌 기능 초기화
    initImageZoom(imageElement) {
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        let initialDistance = 0;
        let initialScale = 1;

        const container = imageElement.parentElement;
        const zoomHint = container.querySelector('.zoom-hint');

        // 초기 상태 설정
        const updateTransform = () => {
            imageElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            imageElement.style.transition = isDragging ? 'none' : 'transform 0.3s ease';
        };

        // 줌 힌트 표시/숨김
        const showZoomHint = () => {
            zoomHint.style.opacity = '1';
            setTimeout(() => {
                if (zoomHint) zoomHint.style.opacity = '0';
            }, 3000);
        };

        // 터치 거리 계산
        const getTouchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // 마우스 휠 줌
        imageElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.5, Math.min(5, scale * delta));
            
            if (newScale !== scale) {
                scale = newScale;
                updateTransform();
                
                if (scale === 0.5) {
                    translateX = 0;
                    translateY = 0;
                    updateTransform();
                }
            }
        });

        // 터치 시작
        imageElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                // 핀치 줌 시작
                initialDistance = getTouchDistance(e.touches);
                initialScale = scale;
                showZoomHint();
            } else if (e.touches.length === 1) {
                // 드래그 시작
                isDragging = true;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            }
        });

        // 터치 이동
        imageElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                // 핀치 줌
                const currentDistance = getTouchDistance(e.touches);
                const newScale = Math.max(0.5, Math.min(5, initialScale * (currentDistance / initialDistance)));
                scale = newScale;
                updateTransform();
                
                if (scale <= 0.6) {
                    translateX = 0;
                    translateY = 0;
                    updateTransform();
                }
            } else if (e.touches.length === 1 && isDragging) {
                // 드래그
                const deltaX = e.touches[0].clientX - lastX;
                const deltaY = e.touches[0].clientY - lastY;
                translateX += deltaX;
                translateY += deltaY;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                updateTransform();
            }
        });

        // 터치 종료
        imageElement.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                isDragging = false;
            }
        });

        // 마우스 드래그
        imageElement.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            imageElement.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                translateX += deltaX;
                translateY += deltaY;
                lastX = e.clientX;
                lastY = e.clientY;
                updateTransform();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                imageElement.style.cursor = 'grab';
            }
        });

        // 더블탭으로 리셋 (모바일)
        let lastTap = 0;
        imageElement.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0 && e.touches.length === 0) {
                e.preventDefault();
                // 리셋
                scale = 1;
                translateX = 0;
                translateY = 0;
                updateTransform();
                showZoomHint();
            }
            lastTap = currentTime;
        });

        // 더블클릭으로 리셋 (데스크톱)
        imageElement.addEventListener('dblclick', (e) => {
            e.preventDefault();
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        });

        // 초기 커서 설정
        imageElement.style.cursor = 'grab';
        
        // 초기 힌트 표시
        setTimeout(showZoomHint, 500);
    }

    // 전체 화면 모달 닫기
    closeFullscreenModal() {
        const modal = document.querySelector('.fullscreen-image-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    // HTML 이스케이프 (XSS 방지)
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 카드 삭제 (GitHub에서 직접 삭제)
    async deleteCard(cardId) {
        if (!this.isGithubConfigured()) {
            this.showMessage('GitHub 설정을 먼저 완료해주세요.', 'error');
            return;
        }

        try {
            this.showMessage('카드 삭제 중...', 'info');
            
            // 카드 찾기
            const cardIndex = this.cards.findIndex(c => c.id === cardId);
            if (cardIndex === -1) {
                this.showMessage('삭제할 카드를 찾을 수 없습니다.', 'error');
                return;
            }

            const card = this.cards[cardIndex];
            console.log('삭제할 카드:', card.customerName, '파일명:', card.fileName);

            // 1단계: GitHub에서 이미지 파일 삭제
            if (card.fileName) {
                try {
                    await this.deleteImageFromGithub(card.fileName);
                    console.log('이미지 파일 삭제 완료:', card.fileName);
                } catch (imageError) {
                    console.warn('이미지 삭제 실패 (계속 진행):', imageError.message);
                    // 이미지 삭제 실패해도 데이터는 삭제 진행
                }
            }

            // 2단계: 카드 배열에서 제거
            this.cards.splice(cardIndex, 1);

            // 3단계: GitHub에 업데이트된 데이터 저장
            await this.saveCardsToGithub();

            // 4단계: 화면 업데이트
            if (this.currentSection === 'search') {
                this.displayCards(this.cards);
            }

            // 5단계: 모달 닫기
            this.closeAllModals();

            this.showMessage(`상담 카드와 이미지가 삭제되었습니다. (${card.customerName})`, 'success');
            
        } catch (error) {
            console.error('삭제 오류:', error);
            this.showMessage(`삭제 실패: ${error.message}`, 'error');
        }
    }

    // GitHub에서 이미지 파일 삭제
    async deleteImageFromGithub(fileName) {
        if (!fileName) {
            console.log('삭제할 파일명이 없습니다.');
            return;
        }

        try {
            const imagePath = `${this.imageFolder}/${fileName}`;
            console.log('GitHub 이미지 삭제 시작:', imagePath);

            // 1단계: 파일 정보 가져오기 (SHA 값 필요)
            const getResponse = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${imagePath}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'ConsultationCardManager/1.0'
                    }
                }
            );

            if (!getResponse.ok) {
                if (getResponse.status === 404) {
                    console.log('이미지 파일이 이미 존재하지 않습니다:', fileName);
                    return; // 파일이 없으면 삭제 완료로 간주
                } else {
                    throw new Error(`파일 정보 가져오기 실패 (${getResponse.status}): ${getResponse.statusText}`);
                }
            }

            const fileData = await getResponse.json();
            const fileSha = fileData.sha;
            console.log('파일 SHA 확인:', fileSha?.substring(0, 8));

            // 2단계: 파일 삭제
            const deleteResponse = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${imagePath}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'ConsultationCardManager/1.0'
                    },
                    body: JSON.stringify({
                        message: `Delete consultation card image: ${fileName}`,
                        sha: fileSha,
                        branch: this.githubConfig.branch
                    })
                }
            );

            if (deleteResponse.ok) {
                console.log('GitHub 이미지 삭제 성공:', fileName);
            } else {
                const errorData = await deleteResponse.text();
                console.error('GitHub 이미지 삭제 실패:', deleteResponse.status, errorData);
                
                if (deleteResponse.status === 401) {
                    throw new Error('GitHub 토큰이 유효하지 않습니다.');
                } else if (deleteResponse.status === 403) {
                    throw new Error('GitHub API 권한이 부족합니다.');
                } else if (deleteResponse.status === 409) {
                    throw new Error('파일이 다른 곳에서 수정되었습니다. 동기화 후 다시 시도하세요.');
                } else {
                    throw new Error(`이미지 삭제 실패 (${deleteResponse.status}): ${deleteResponse.statusText}`);
                }
            }

        } catch (error) {
            console.error('GitHub 이미지 삭제 오류:', error);
            throw error;
        }
    }

    // 설정 표시
    showSettings() {
        document.getElementById('githubOwner').value = this.githubConfig.owner || '';
        document.getElementById('githubRepo').value = this.githubConfig.repo || '';
        document.getElementById('githubToken').value = this.githubConfig.token || '';
        document.getElementById('githubBranch').value = this.githubConfig.branch || 'main';
        
        document.getElementById('settingsModal').style.display = 'block';
    }

    // 설정 저장
    async saveSettings() {
        const newConfig = {
            owner: document.getElementById('githubOwner').value.trim(),
            repo: document.getElementById('githubRepo').value.trim(),
            token: document.getElementById('githubToken').value.trim(),
            branch: document.getElementById('githubBranch').value.trim() || 'main'
        };

        if (!newConfig.owner || !newConfig.repo || !newConfig.token) {
            this.showMessage('모든 필수 항목을 입력해주세요.', 'error');
            return;
        }

        this.githubConfig = newConfig;
        localStorage.setItem('githubConfig', JSON.stringify(this.githubConfig));
        
        try {
            // 설정 저장 후 즉시 데이터 로드
            await this.loadCardsFromGithub();
            this.showMessage('GitHub 설정이 저장되고 데이터가 로드되었습니다.', 'success');
        } catch (error) {
            this.showMessage('설정은 저장되었지만 데이터 로드에 실패했습니다.', 'error');
        }
        
        this.closeAllModals();
    }

    // 연결 테스트
    async testConnection() {
        const owner = document.getElementById('githubOwner').value.trim();
        const repo = document.getElementById('githubRepo').value.trim();
        const token = document.getElementById('githubToken').value.trim();

        if (!owner || !repo || !token) {
            this.showMessage('모든 필수 항목을 입력해주세요.', 'error');
            return;
        }

        try {
            this.showMessage('GitHub 연결 테스트 중...', 'info');
            
            // 1단계: 저장소 접근 테스트
            const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'ConsultationCardManager/1.0'
                }
            });

            if (!repoResponse.ok) {
                if (repoResponse.status === 401) {
                    throw new Error('토큰이 유효하지 않습니다.');
                } else if (repoResponse.status === 404) {
                    throw new Error('저장소를 찾을 수 없습니다. 저장소명을 확인해주세요.');
                } else {
                    throw new Error(`저장소 접근 실패 (${repoResponse.status})`);
                }
            }

            const repoData = await repoResponse.json();
            
            // 2단계: Contents API 권한 테스트
            const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'ConsultationCardManager/1.0'
                }
            });

            if (!contentsResponse.ok && contentsResponse.status !== 404) {
                throw new Error('Contents API 권한이 없습니다. 토큰에 Contents 권한을 추가해주세요.');
            }

            this.showMessage(`✅ GitHub 연결 성공!\n저장소: ${repoData.full_name}\n권한: Contents API 사용 가능`, 'success');
            
        } catch (error) {
            console.error('연결 테스트 실패:', error);
            this.showMessage(`❌ GitHub 연결 실패: ${error.message}`, 'error');
        }
    }

    // 모달 닫기
    closeAllModals() {
        document.getElementById('imageModal').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'none';
        this.closeFullscreenModal();
    }

    // 날짜 포맷
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ko-KR');
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('ko-KR');
    }

    // 저장소 정리 (고아 이미지 파일 삭제)
    async cleanupStorage() {
        if (!this.isGithubConfigured()) {
            this.showMessage('GitHub 설정을 먼저 완료해주세요.', 'error');
            return;
        }

        const confirmMessage = `저장소 정리를 실행하시겠습니까?\n\n다음 작업을 수행합니다:\n• 데이터에 없는 고아 이미지 파일 검색\n• 사용되지 않는 이미지 파일 삭제\n\n⚠️ 삭제된 파일은 복구할 수 없습니다.\n계속하시겠습니까?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            this.showMessage('저장소 정리 중... 이미지 파일 목록을 가져오는 중', 'info');

            // 1단계: GitHub에서 이미지 폴더의 모든 파일 목록 가져오기
            const imageFiles = await this.getImageFilesFromGithub();
            console.log('GitHub 이미지 파일 수:', imageFiles.length);

            if (imageFiles.length === 0) {
                this.showMessage('정리할 이미지 파일이 없습니다.', 'info');
                return;
            }

            // 2단계: 현재 데이터에서 사용 중인 파일명 목록 생성
            const usedFileNames = new Set();
            this.cards.forEach(card => {
                if (card.fileName) {
                    usedFileNames.add(card.fileName);
                }
            });

            console.log('사용 중인 파일 수:', usedFileNames.size);

            // 3단계: 고아 파일 (사용되지 않는 파일) 찾기
            const orphanFiles = imageFiles.filter(file => !usedFileNames.has(file.name));
            console.log('고아 파일 수:', orphanFiles.length);

            if (orphanFiles.length === 0) {
                this.showMessage('정리할 고아 파일이 없습니다. 저장소가 깨끗합니다! ✨', 'success');
                return;
            }

            // 4단계: 사용자에게 삭제할 파일 목록 확인
            const fileList = orphanFiles.slice(0, 10).map(f => f.name).join('\n');
            const moreFiles = orphanFiles.length > 10 ? `\n... 외 ${orphanFiles.length - 10}개 파일` : '';
            
            const deleteConfirm = confirm(`${orphanFiles.length}개의 고아 파일을 발견했습니다.\n\n삭제할 파일들:\n${fileList}${moreFiles}\n\n이 파일들을 삭제하시겠습니까?`);
            
            if (!deleteConfirm) {
                this.showMessage('저장소 정리가 취소되었습니다.', 'info');
                return;
            }

            // 5단계: 고아 파일들 삭제
            this.showMessage(`${orphanFiles.length}개 파일 삭제 중...`, 'info');
            
            let deletedCount = 0;
            let errorCount = 0;

            for (const file of orphanFiles) {
                try {
                    await this.deleteImageFileByPath(file.path, file.sha);
                    deletedCount++;
                    console.log(`삭제 완료: ${file.name}`);
                } catch (error) {
                    errorCount++;
                    console.error(`삭제 실패: ${file.name}`, error);
                }
            }

            // 6단계: 결과 보고
            if (errorCount === 0) {
                this.showMessage(`저장소 정리 완료! ${deletedCount}개 파일이 삭제되었습니다. ✨`, 'success');
            } else {
                this.showMessage(`저장소 정리 완료! ${deletedCount}개 파일 삭제, ${errorCount}개 파일 삭제 실패`, 'info');
            }

        } catch (error) {
            console.error('저장소 정리 오류:', error);
            this.showMessage(`저장소 정리 실패: ${error.message}`, 'error');
        }
    }

    // GitHub에서 이미지 파일 목록 가져오기
    async getImageFilesFromGithub() {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.imageFolder}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'ConsultationCardManager/1.0'
                    }
                }
            );

            if (response.ok) {
                const files = await response.json();
                // 이미지 파일만 필터링 (.jpg, .jpeg)
                return files.filter(file => 
                    file.type === 'file' && 
                    (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg'))
                );
            } else if (response.status === 404) {
                console.log('이미지 폴더가 존재하지 않습니다.');
                return [];
            } else {
                throw new Error(`이미지 목록 가져오기 실패 (${response.status}): ${response.statusText}`);
            }
        } catch (error) {
            console.error('이미지 파일 목록 가져오기 오류:', error);
            throw error;
        }
    }

    // 경로와 SHA로 이미지 파일 삭제
    async deleteImageFileByPath(filePath, fileSha) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'ConsultationCardManager/1.0'
                    },
                    body: JSON.stringify({
                        message: `Cleanup: Delete orphan image file ${filePath.split('/').pop()}`,
                        sha: fileSha,
                        branch: this.githubConfig.branch
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`파일 삭제 실패 (${response.status}): ${response.statusText}`);
            }
        } catch (error) {
            console.error('파일 삭제 오류:', error);
            throw error;
        }
    }
    // 메시지 표시
    showMessage(message, type) {
        const existing = document.querySelector('.message');
        if (existing) existing.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // 모바일에서 더 명확한 아이콘 추가
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        
        messageDiv.innerHTML = `${icons[type] || ''} ${message}`;

        const section = document.querySelector('.section:not(.hidden)');
        if (section) {
            section.parentNode.insertBefore(messageDiv, section);
        } else {
            document.body.insertBefore(messageDiv, document.body.firstChild);
        }

        // 모바일에서 햅틱 피드백 (지원되는 경우)
        if (navigator.vibrate) {
            if (type === 'success') {
                navigator.vibrate(100);
            } else if (type === 'error') {
                navigator.vibrate([100, 50, 100]);
            }
        }

        // 메시지 자동 제거
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 4000);
    }

    // 카메라 열기 (환경 카메라 우선)
    openCamera() {
        const fileInput = document.getElementById('cardImage');
        
        // 모바일 환경에서 카메라 직접 열기
        if (this.isMobileDevice()) {
            fileInput.setAttribute('capture', 'environment');
            fileInput.setAttribute('accept', 'image/jpeg,image/jpg');
            fileInput.click();
        } else {
            // 데스크톱에서는 일반 파일 선택
            this.showMessage('데스크톱에서는 파일을 선택해주세요.', 'info');
            fileInput.click();
        }
    }

    // 갤러리 열기 (저장된 사진에서 선택)
    openGallery() {
        const fileInput = document.getElementById('cardImage');
        
        // capture 속성 제거하여 갤러리 접근
        fileInput.removeAttribute('capture');
        fileInput.setAttribute('accept', 'image/jpeg,image/jpg');
        
        // 갤러리 모드 안내
        if (this.isMobileDevice()) {
            this.showMessage('🖼️ 갤러리에서 사진을 선택하세요.', 'info');
        }
        
        fileInput.click();
    }

    // 사진 다시 촬영 (문서 스캔 모드)
    retakePhoto() {
        document.getElementById('imagePreview').classList.add('hidden');
        document.getElementById('cardImage').value = '';
        this.currentImageFile = null;
        
        // 문서 스캔 모드로 다시 촬영
        const fileInput = document.getElementById('cardImage');
        fileInput.setAttribute('capture', 'environment');
        fileInput.setAttribute('accept', 'image/jpeg,image/jpg');
        
        if (this.isMobileDevice()) {
            if (this.isIOSDevice()) {
                this.showMessage('📄 카메라에서 문서 모드를 선택하세요.', 'info');
            } else {
                this.showMessage('📄 문서 스캔 모드로 다시 촬영합니다.', 'info');
            }
        }
        
        fileInput.click();
    }

    // 이미지 개선 (간단한 필터 적용)
    async enhanceImage() {
        if (!this.currentImageFile) {
            this.showMessage('개선할 이미지가 없습니다.', 'error');
            return;
        }

        try {
            this.showMessage('이미지 개선 중...', 'info');
            
            // Canvas를 사용한 이미지 개선
            const enhancedFile = await this.applyImageEnhancement(this.currentImageFile);
            
            if (enhancedFile) {
                this.currentImageFile = enhancedFile;
                this.updateImagePreview(enhancedFile);
                this.showMessage('이미지가 개선되었습니다! ✨', 'success');
            }
        } catch (error) {
            console.error('이미지 개선 오류:', error);
            this.showMessage('이미지 개선에 실패했습니다.', 'error');
        }
    }

    // 이미지 개선 적용 (밝기, 대비, 선명도 조정)
    async applyImageEnhancement(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                // 원본 이미지 그리기
                ctx.drawImage(img, 0, 0);

                // 이미지 데이터 가져오기
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 밝기와 대비 조정
                const brightness = 10; // 밝기 증가
                const contrast = 1.2;  // 대비 증가

                for (let i = 0; i < data.length; i += 4) {
                    // RGB 값 조정
                    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));     // Red
                    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness)); // Green
                    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness)); // Blue
                }

                // 개선된 이미지 데이터 적용
                ctx.putImageData(imageData, 0, 0);

                // Canvas를 Blob으로 변환
                canvas.toBlob((blob) => {
                    if (blob) {
                        const enhancedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(enhancedFile);
                    } else {
                        reject(new Error('이미지 변환 실패'));
                    }
                }, 'image/jpeg', 0.9);
            };

            img.onerror = () => reject(new Error('이미지 로드 실패'));
            img.src = URL.createObjectURL(file);
        });
    }

    // 이미지 미리보기 업데이트
    updateImagePreview(file) {
        const preview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    // 모바일 디바이스 감지
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // iOS 디바이스 감지
    isIOSDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }
}

// 앱 시작
const consultationManager = new ConsultationCardManager();