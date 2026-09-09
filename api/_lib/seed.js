export function syntheticPrivateItems(handle) {
  return [
    {
      title: '계정별 작업 메모 01',
      content: handle + ' 전용으로 생성된 synthetic 기록입니다.',
      sort_order: 1
    },
    {
      title: '계정별 작업 메모 02',
      content: '인증된 세션에서만 읽을 수 있는 예시 자료입니다.',
      sort_order: 2
    },
    {
      title: '계정별 작업 메모 03',
      content: '다른 계정의 별칭을 보내도 현재 계정 자료만 반환됩니다.',
      sort_order: 3
    }
  ];
}
