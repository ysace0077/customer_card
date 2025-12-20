// 고객 상담 카드 관리 시스템 - GitHub 직접 연동 버전
class ConsultationCardManager {
    constructor() {
        this.cards = [];
        this.currentSection = 'upload';
        
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
            this.githubConfig = JSON.parse(saved);
            console.log('GitHub 설정 로드됨:', this.githubConfig.owner + '/' + this.githubConfig.repo);
            
            // GitHub 설정이 있으면 즉시 데이터 로드
            if (this.isGithubConfigured()) {
                await this.loadCardsFromGithub();
            } else {
                this.showMessage('GitHub 설정을 완료해주세요.', 'info');
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

        // 모바일에서 파일 선택 시 카메라 옵션 표시
        const fileInput = document.getElementById('cardImage');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            fileInput.setAttribute('capture', 'environment');
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

        // 설정
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
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
            return;
        }

        this.showMessage('최신 데이터를 불러오는 중...', 'info');
        
        try {
            await this.loadCardsFromGithub();
            this.displayCards(this.cards);
            this.showMessage(`${this.cards.length}개의 상담 카드를 불러왔습니다.`, 'success');
        } catch (error) {
            console.error('검색 데이터 로드 오류:', error);
            this.showMessage('데이터 로드 중 오류가 발생했습니다.', 'error');
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
        const file = formData.get('cardImage');
        
        if (!file || !this.validateFile({target: {files: [file]}})) {
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
            const path = `${this.imageFolder}/${fileName}`;
            
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Content-Type': 'application/json'
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
                const error = await response.json();
                throw new Error(`GitHub 이미지 업로드 실패: ${error.message}`);
            }
        } catch (error) {
            console.error('GitHub 이미지 업로드 오류:', error);
            throw error;
        }
    }

    // GitHub에서 카드 데이터 로드
    async loadCardsFromGithub() {
        if (!this.isGithubConfigured()) {
            console.log('GitHub 설정이 없습니다.');
            return;
        }

        try {
            console.log('GitHub에서 데이터 로드 시작...');
            
            // 캐시 무시를 위한 타임스탬프 추가
            const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
            const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.dataFile}${cacheBuster}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                console.log('GitHub 응답 받음, SHA:', data.sha?.substring(0, 8));
                
                // Base64 디코딩
                const content = decodeURIComponent(escape(atob(data.content)));
                const githubCards = JSON.parse(content);
                
                if (Array.isArray(githubCards)) {
                    this.cards = githubCards;
                    console.log('GitHub에서 카드 로드 완료:', this.cards.length, '개');
                } else {
                    throw new Error('GitHub에서 받은 데이터가 올바르지 않습니다.');
                }
            } else if (response.status === 404) {
                console.log('데이터 파일이 없습니다. 새로 생성합니다.');
                this.cards = [];
                await this.saveCardsToGithub();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('GitHub 데이터 로드 실패:', error);
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
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (getResponse.ok) {
                    const currentData = await getResponse.json();
                    sha = currentData.sha;
                }
            } catch (e) {
                // 파일이 없으면 새로 생성
                console.log('기존 파일 없음 - 새로 생성');
            }

            // 데이터를 JSON 문자열로 변환 후 Base64 인코딩
            const jsonString = JSON.stringify(this.cards, null, 2);
            const content = btoa(unescape(encodeURIComponent(jsonString)));

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
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (response.ok) {
                console.log('GitHub에 데이터 저장 성공');
            } else {
                const error = await response.json();
                throw new Error(`GitHub API 오류: ${error.message}`);
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

        container.innerHTML = sorted.map(card => `
            <div class="card-item text-only" ontouchstart="">
                <button class="delete-btn" onclick="event.stopPropagation(); consultationManager.deleteCard('${card.id}')" title="카드 삭제">
                    🗑️
                </button>
                <div class="card-info" onclick="consultationManager.showCardDetail('${card.id}')">
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

    // 텍스트 자르기
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // 카드 상세 보기
    showCardDetail(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalInfo = document.getElementById('modalInfo');

        modalImage.src = card.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f0f0f0" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="%23999" font-size="20">이미지 없음</text></svg>';

        modalInfo.innerHTML = `
            <h3>${card.customerName} - 상담 카드</h3>
            <p><strong>판매자:</strong> ${card.salesperson}</p>
            <p><strong>상담 날짜:</strong> ${this.formatDate(card.consultationDate)}</p>
            <p><strong>업로드:</strong> ${this.formatDateTime(card.uploadDate)}</p>
            <p><strong>파일명:</strong> ${card.fileName}</p>
            ${card.notes ? `<p><strong>메모:</strong> ${card.notes}</p>` : ''}
        `;

        modal.style.display = 'block';
    }

    // 카드 삭제 (GitHub에서 직접 삭제)
    async deleteCard(cardId) {
        if (!confirm('이 상담 카드를 삭제하시겠습니까?\n\nGitHub에서 완전히 삭제됩니다.')) {
            return;
        }

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

            // 카드 배열에서 제거
            this.cards.splice(cardIndex, 1);

            // GitHub에 업데이트된 데이터 저장
            await this.saveCardsToGithub();

            // 화면 업데이트
            if (this.currentSection === 'search') {
                this.displayCards(this.cards);
            }

            // 모달 닫기
            this.closeAllModals();

            this.showMessage('상담 카드가 삭제되었습니다.', 'success');
            
        } catch (error) {
            console.error('삭제 오류:', error);
            this.showMessage(`삭제 실패: ${error.message}`, 'error');
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
            
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const repoData = await response.json();
                this.showMessage(`✅ GitHub 연결 성공!\n저장소: ${repoData.full_name}`, 'success');
            } else {
                const error = await response.json();
                this.showMessage(`❌ GitHub 연결 실패: ${error.message}`, 'error');
            }
        } catch (error) {
            this.showMessage(`❌ 연결 오류: ${error.message}`, 'error');
        }
    }

    // 모달 닫기
    closeAllModals() {
        document.getElementById('imageModal').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'none';
    }

    // 날짜 포맷
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ko-KR');
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('ko-KR');
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
        section.parentNode.insertBefore(messageDiv, section);

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
}

// 앱 시작
const consultationManager = new ConsultationCardManager();