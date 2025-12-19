# 고객 상담 카드 관리 시스템

판매자별 고객 상담 카드를 업로드하고 관리할 수 있는 웹 애플리케이션입니다.

## 주요 기능

### 📤 상담 카드 업로드
- 판매자명, 고객명, 상담 날짜 입력
- JPG 형태의 상담 카드 이미지 업로드
- 선택적 메모 기능
- 파일 크기 및 형식 검증 (최대 10MB, JPG만 허용)

### 🔍 상담 카드 검색 및 관리
- 고객명으로 빠른 검색
- 판매자별 필터링
- 날짜 범위 필터링
- 카드 이미지 미리보기
- 상세 정보 모달 뷰

### 💾 데이터 관리
- 로컬 스토리지를 통한 데이터 저장
- 자동 백업 및 복원
- 반응형 디자인으로 모바일 지원

## GitHub Pages 설정

이 시스템은 GitHub Pages에서 호스팅되며, 업로드된 이미지는 GitHub 저장소에 자동으로 저장됩니다.

### GitHub Personal Access Token 생성

1. GitHub 설정 페이지로 이동: https://github.com/settings/tokens
2. "Generate new token (classic)" 클릭
3. 토큰 이름 입력 (예: "Consultation Cards")
4. 권한 선택:
   - ✅ `repo` (전체 저장소 접근)
   - 또는 최소한 `public_repo` (공개 저장소만)
5. "Generate token" 클릭
6. 생성된 토큰을 안전하게 복사 (다시 볼 수 없습니다!)

### 애플리케이션 설정

1. 웹 페이지에서 "⚙️ GitHub 설정" 버튼 클릭
2. 다음 정보 입력:
   - **GitHub 사용자명/조직명**: 저장소 소유자 이름
   - **저장소명**: 이 프로젝트의 저장소 이름
   - **Personal Access Token**: 위에서 생성한 토큰
   - **브랜치명**: 기본값 `main` (또는 사용 중인 브랜치)
3. "🔗 연결 테스트" 버튼으로 연결 확인
4. "💾 설정 저장" 클릭

### 데이터 저장 구조

```
customer_consultation_cards/
├── data/
│   └── consultation_cards.json  # 모든 상담 카드 메타데이터
└── images/
    ├── 20231219_김철수_박영희_1703001234567.jpg
    ├── 20231220_이영희_최민수_1703087654321.jpg
    └── ...
```

### 다중 기기 동기화

- ✅ **자동 동기화**: 5분마다 GitHub에서 최신 데이터 자동 로드
- ✅ **수동 동기화**: 🔄 동기화 버튼으로 즉시 동기화
- ✅ **오프라인 지원**: 인터넷 연결 없이도 로컬 데이터 사용 가능
- ✅ **실시간 공유**: 여러 사용자가 동시에 데이터 접근 가능

## 사용 방법

### 0. 초기 설정 (한 번만)
1. GitHub Personal Access Token 생성
2. "⚙️ GitHub 설정"에서 저장소 정보 입력
3. "🔗 연결 테스트"로 설정 확인
4. "💾 설정 저장" 완료

### 1. 상담 카드 업로드
1. "상담 카드 업로드" 버튼 클릭
2. 필수 정보 입력:
   - 판매자명
   - 고객명
   - 상담 날짜
   - 상담 카드 이미지 (JPG 파일)
3. 선택적으로 메모 추가
4. "업로드" 버튼 클릭

### 2. 상담 카드 검색
1. "카드 검색" 버튼 클릭
2. 고객명으로 검색하거나 필터 사용:
   - 판매자별 필터
   - 날짜 범위 필터
3. 카드 이미지 클릭으로 상세 보기

### 3. 다른 기기에서 접근
1. 동일한 GitHub Pages URL 접속
2. "⚙️ GitHub 설정"에서 동일한 저장소 정보 입력
3. 자동으로 모든 데이터 동기화됨

### 4. 키보드 단축키
- `Ctrl + 1`: 업로드 섹션으로 이동
- `Ctrl + 2`: 검색 섹션으로 이동
- `Ctrl + F`: 검색 입력란에 포커스 (검색 섹션에서)
- `ESC`: 모달 닫기

## 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: 
  - LocalStorage (메타데이터)
  - GitHub Repository (이미지 파일)
- **File Handling**: FileReader API, Canvas API
- **API Integration**: GitHub REST API v3
- **Hosting**: GitHub Pages
- **Responsive Design**: CSS Grid & Flexbox

## 파일 구조

```
customer_consultation_cards/
├── index.html          # 메인 HTML 파일
├── styles.css          # 스타일시트
├── app.js             # 메인 JavaScript 로직
└── README.md          # 프로젝트 문서
```

## 데이터 구조

각 상담 카드는 다음 정보를 포함합니다:

```javascript
{
    id: "고유 식별자",
    salesperson: "판매자명",
    customerName: "고객명",
    consultationDate: "상담 날짜",
    notes: "메모",
    imageData: "Base64 인코딩된 이미지 데이터",
    fileName: "원본 파일명",
    uploadDate: "업로드 날짜",
    fileSize: "파일 크기"
}
```

## 브라우저 호환성

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 보안 고려사항

- **메타데이터**: 브라우저 LocalStorage에 저장
- **이미지 파일**: GitHub 저장소에 안전하게 저장
- **인증**: GitHub Personal Access Token 사용
- **권한**: 최소 필요 권한만 요청 (Contents 권한)
- **파일 검증**: 형식 및 크기 검증을 통한 보안 강화
- **HTTPS**: GitHub Pages의 SSL 인증서 사용

## 향후 개선 계획

- [ ] 서버 기반 저장소 연동
- [ ] 다중 파일 업로드 지원
- [ ] 상담 카드 편집 기능
- [ ] 데이터 내보내기/가져오기 기능
- [ ] 고급 검색 필터
- [ ] 상담 통계 대시보드

## 라이선스

MIT License

## 문의사항

프로젝트 관련 문의사항이 있으시면 이슈를 등록해 주세요.