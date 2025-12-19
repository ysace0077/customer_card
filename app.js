// 고객 상담 카드 관리 시스템
class ConsultationCardManager {
    constructor() {
        this.cards = [];
        this.currentSection = 'upload';
        this.filters = {
            searchTerm: '',
            salesperson: '',
            period: 'all'
        };
        
        // GitHub 설정
        this.githubConfig = {
            owner: '',
            repo: '',
            token: '',
            branch: 'main'
        };
        
        this.init();
    }

    async init() {
        console.log('앱 초기화 시작');
        this.loadGithubConfig();
        this.bindEvents();
        this.setDefaultDate();
        await this.loadData();
        console.log('앱 초기화 완료, 카드 수:', this.cards.length);
    }

    // GitHub 설정 로드
    loadGithubConfig() {
        const saved = localStorage.getItem('githubConfig');
        if (saved) {
            this.githubConfig = JSON.parse(saved);
            console.log('GitHub 설정 로드됨:', this.githubConfig.owner + '/' + this.githubConfig.repo);
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

        // 검색
        document.getElementById('searchExecute').addEventListener('click', () => this.applyFilters());
        document.getElementById('searchCustomer').addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.applyFilters(), 300);
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

    // 검색용 데이터 로드 (GitHub 우선)
    async loadSearchData() {
        this.showMessage('최신 데이터를 불러오는 중...', 'info');
        
        try {
            if (this.isGithubConfigured()) {
                // GitHub에서 최신 데이터 로드
                await this.loadDataFromGithub();
                console.log('검색용 GitHub 데이터 로드 완료:', this.cards.length, '개');
            } else {
                // GitHub 설정이 없으면 로컬 데이터 사용
                console.log('GitHub 설정 없음 - 로컬 데이터 사용:', this.cards.length, '개');
            }
            
            this.displayCards(this.cards);
            this.showMessage(`${this.cards.length}개의 상담 카드를 불러왔습니다.`, 'success');
            
        } catch (error) {
            console.error('검색 데이터 로드 오류:', error);
            this.showMessage('데이터 로드 중 오류가 발생했습니다.', 'error');
            // 오류 시 로컬 데이터라도 표시
            this.displayCards(this.cards);
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

    // 업로드 처리
    async handleUpload(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const file = formData.get('cardImage');
        
        if (!file || !this.validateFile({target: {files: [file]}})) {
            return;
        }

        try {
            this.showMessage('업로드 중...', 'info');
            
            // 파일명 생성
            const timestamp = Date.now();
            const customerName = formData.get('customerName').replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const salesperson = formData.get('salesperson').replace(/[^a-zA-Z0-9가-힣]/g, '_');
            const date = formData.get('consultationDate').replace(/-/g, '');
            const fileName = `${date}_${salesperson}_${customerName}_${timestamp}.jpg`;

            // 이미지를 Base64로 변환
            const imageData = await this.fileToBase64(file);
            
            // 카드 데이터 생성
            const cardData = {
                id: timestamp.toString(),
                salesperson: formData.get('salesperson'),
                customerName: formData.get('customerName'),
                consultationDate: formData.get('consultationDate'),
                notes: formData.get('notes') || '',
                fileName: fileName,
                uploadDate: new Date().toISOString(),
                imageUrl: '' // GitHub 업로드 후 설정
            };

            // GitHub에 이미지 업로드
            if (this.isGithubConfigured()) {
                const githubUrl = await this.uploadImageToGithub(imageData, fileName);
                if (githubUrl) {
                    cardData.imageUrl = githubUrl;
                    console.log('GitHub 업로드 성공:', githubUrl);
                }
            }

            // 카드 추가 및 저장
            this.cards.push(cardData);
            await this.saveData();
            
            this.showMessage('상담 카드가 업로드되었습니다.', 'success');
            event.target.reset();
            this.setDefaultDate();
            
        } catch (error) {
            console.error('업로드 오류:', error);
            this.showMessage('업로드 중 오류가 발생했습니다.', 'error');
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

    // GitHub 설정 확인
    isGithubConfigured() {
        return this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token;
    }

    // GitHub에 이미지 업로드
    async uploadImageToGithub(imageData, fileName) {
        if (!this.isGithubConfigured()) {
            console.log('GitHub 설정 없음');
            return null;
        }

        try {
            const base64Data = imageData.split(',')[1];
            const path = `images/${fileName}`;
            
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Add consultation card: ${fileName}`,
                        content: base64Data,
                        branch: this.githubConfig.branch
                    })
                }
            );

            if (response.ok) {
                return `https://${this.githubConfig.owner}.github.io/${this.githubConfig.repo}/${path}`;
            } else {
                console.error('GitHub 업로드 실패:', response.status);
                return null;
            }
        } catch (error) {
            console.error('GitHub 업로드 오류:', error);
            return null;
        }
    }

    // 데이터 저장
    async saveData() {
        // 로컬 저장
        localStorage.setItem('consultationCards', JSON.stringify(this.cards));
        
        // GitHub 저장
        if (this.isGithubConfigured()) {
            await this.saveDataToGithub();
        }
    }

    // GitHub에 데이터 저장
    async saveDataToGithub() {
        try {
            const path = 'data/cards.json';
            
            // 현재 파일의 SHA 가져오기
            let sha = null;
            try {
                const getResponse = await fetch(
                    `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
                    {
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`
                        }
                    }
                );
                if (getResponse.ok) {
                    const data = await getResponse.json();
                    sha = data.sha;
                }
            } catch (e) {
                // 파일이 없으면 새로 생성
            }

            // 데이터 인코딩
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(this.cards, null, 2))));
            
            const body = {
                message: `Update consultation cards: ${new Date().toISOString()}`,
                content: content,
                branch: this.githubConfig.branch
            };
            
            if (sha) {
                body.sha = sha;
            }

            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (response.ok) {
                console.log('GitHub 데이터 저장 성공');
            } else {
                console.error('GitHub 데이터 저장 실패:', response.status);
            }
        } catch (error) {
            console.error('GitHub 저장 오류:', error);
        }
    }

    // 데이터 로드
    async loadData() {
        // 로컬 데이터 로드
        const localData = localStorage.getItem('consultationCards');
        if (localData) {
            this.cards = JSON.parse(localData);
        }

        // GitHub에서 로드
        if (this.isGithubConfigured()) {
            await this.loadDataFromGithub();
        }
    }

    // GitHub에서 데이터 로드
    async loadDataFromGithub() {
        try {
            const path = 'data/cards.json';
            const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}?t=${Date.now()}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const content = decodeURIComponent(escape(atob(data.content)));
                const githubCards = JSON.parse(content);
                
                if (Array.isArray(githubCards) && githubCards.length > 0) {
                    this.cards = githubCards;
                    localStorage.setItem('consultationCards', JSON.stringify(this.cards));
                    console.log('GitHub에서 데이터 로드:', this.cards.length, '개');
                }
            }
        } catch (error) {
            console.error('GitHub 로드 오류:', error);
        }
    }

    // 동기화
    async syncData() {
        this.showMessage('동기화 중...', 'info');
        
        try {
            await this.loadDataFromGithub();
            
            if (this.currentSection === 'search') {
                this.displayCards(this.cards);
            }
            
            this.showMessage(`동기화 완료: ${this.cards.length}개 카드`, 'success');
        } catch (error) {
            console.error('동기화 오류:', error);
            this.showMessage('동기화 실패', 'error');
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
                
                this.filters.salesperson = btn.dataset.salesperson;
                console.log('판매자 필터 변경:', this.filters.salesperson || '전체');
            });
        });
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
                
                this.filters.period = btn.dataset.period;
                console.log('기간 필터 변경:', this.filters.period);
            });
        });
    }

    // 필터 적용
    applyFilters() {
        this.filters.searchTerm = document.getElementById('searchCustomer').value.toLowerCase().trim();
        
        let filtered = this.cards;

        // 고객명 검색
        if (this.filters.searchTerm) {
            filtered = filtered.filter(card => 
                card.customerName.toLowerCase().includes(this.filters.searchTerm)
            );
        }

        // 판매자 필터
        if (this.filters.salesperson) {
            filtered = filtered.filter(card => card.salesperson === this.filters.salesperson);
        }

        // 기간 필터
        if (this.filters.period !== 'all') {
            const { dateFrom, dateTo } = this.getPeriodDates(this.filters.period);
            filtered = filtered.filter(card => {
                return card.consultationDate >= dateFrom && card.consultationDate <= dateTo;
            });
        }

        this.displayCards(filtered);
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
        document.getElementById('searchCustomer').value = '';
        this.filters = {
            searchTerm: '',
            salesperson: '',
            period: 'all'
        };
        
        // 판매자 필터 초기화
        document.querySelectorAll('.salesperson-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.salesperson === '') {
                btn.classList.add('active');
            }
        });
        
        // 기간 필터 초기화
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === 'all') {
                btn.classList.add('active');
            }
        });
        
        this.displayCards(this.cards);
        this.showMessage('모든 필터가 초기화되었습니다.', 'info');
    }

    // 카드 표시 (이전 버전 스타일)
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

        if (card.imageUrl) {
            modalImage.src = card.imageUrl;
        } else {
            modalImage.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f0f0f0" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="%23999" font-size="20">이미지 없음</text></svg>';
        }

        modalInfo.innerHTML = `
            <h3>${card.customerName} - 상담 카드</h3>
            <p><strong>판매자:</strong> ${card.salesperson}</p>
            <p><strong>상담 날짜:</strong> ${this.formatDate(card.consultationDate)}</p>
            <p><strong>업로드:</strong> ${this.formatDateTime(card.uploadDate)}</p>
            ${card.notes ? `<p><strong>메모:</strong> ${card.notes}</p>` : ''}
        `;

        modal.style.display = 'block';
    }

    // 카드 삭제
    async deleteCard(cardId) {
        if (!confirm('이 상담 카드를 삭제하시겠습니까?')) {
            return;
        }

        try {
            this.cards = this.cards.filter(c => c.id !== cardId);
            await this.saveData();
            
            if (this.currentSection === 'search') {
                this.applyFilters();
            }
            
            this.showMessage('카드가 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('삭제 오류:', error);
            this.showMessage('삭제 실패', 'error');
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
    saveSettings() {
        this.githubConfig = {
            owner: document.getElementById('githubOwner').value.trim(),
            repo: document.getElementById('githubRepo').value.trim(),
            token: document.getElementById('githubToken').value.trim(),
            branch: document.getElementById('githubBranch').value.trim() || 'main'
        };

        if (!this.githubConfig.owner || !this.githubConfig.repo || !this.githubConfig.token) {
            this.showMessage('모든 필수 항목을 입력해주세요.', 'error');
            return;
        }

        localStorage.setItem('githubConfig', JSON.stringify(this.githubConfig));
        this.showMessage('설정이 저장되었습니다.', 'success');
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
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });

            if (response.ok) {
                this.showMessage('✅ GitHub 연결 성공!', 'success');
            } else {
                this.showMessage('❌ GitHub 연결 실패', 'error');
            }
        } catch (error) {
            this.showMessage('❌ 연결 오류', 'error');
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
        messageDiv.textContent = message;

        const section = document.querySelector('.section:not(.hidden)');
        section.parentNode.insertBefore(messageDiv, section);

        setTimeout(() => messageDiv.remove(), 3000);
    }
}

// 앱 시작
const consultationManager = new ConsultationCardManager();
