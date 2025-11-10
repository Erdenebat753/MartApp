import React, { createContext, useContext, useMemo, useState } from "react";

const STRINGS = {
  en: {
    app_title: "Admin Dashboard",
    home: "Home",
    map_editor: "Map Editor",
    items: "Items",
    viewer3d: "3D Viewer",
    chat: "Chat",
    settings: "Settings",
    mart: "Mart",
    logout: "Logout",

    // EditorSidebar
    all: "ALL",
    segments: "Segments",
    route: "Route",
    category: "Category",
    panels: "Panels",
    view: "View",
    selection: "Selection",
    reload: "Reload",
    clear: "Clear",
    save: "Save",
    compute: "Compute",
    use_slam_start: "Use SLAM Start",
    delete_selected: "Delete Selected",
    show_items: "Show Items",
    hide_items: "Hide Items",
    show_chat: "Show Chat",
    hide_chat: "Hide Chat",
    category_name: "Category name",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    grid_on: "Grid: ON",
    grid_off: "Grid: OFF",
    labels_on: "Labels: ON",
    labels_off: "Labels: OFF",
    no_categories: "No categories yet.",

    // ItemsSidebar
    items_title: "Items",
    slam_start: "SLAM Start",

    // ItemPanel
    create_item: "Create Item",
    edit_item: "Edit Item",
    name: "Name",
    type: "Type",
    heading: "Heading°",
    set_from_map: "Set From Map",
    image: "Image",
    upload: "Upload",
    price: "Price",
    sale_percent: "Sale %",
    sale_ends: "Sale Ends",
    note: "Note",
    description: "Desc",
    save_btn: "Save",
    update_btn: "Update",
    close_btn: "Close",
    tip_edit: "Tip: Click an item to edit.",
    tip_create: "Tip: Click map to set position (snaps to nearby points).",
  },
  ko: {
    app_title: "관리자 대시보드",
    home: "홈",
    map_editor: "맵 편집",
    items: "항목",
    viewer3d: "3D 뷰어",
    chat: "채팅",
    settings: "설정",
    mart: "마트",
    logout: "로그아웃",

    all: "전체",
    segments: "경로 세그먼트",
    route: "경로 안내",
    category: "카테고리",
    panels: "패널",
    view: "보기",
    selection: "선택",
    reload: "새로고침",
    clear: "지우기",
    save: "저장",
    compute: "계산",
    use_slam_start: "SLAM 시작점 사용",
    delete_selected: "선택 삭제",
    show_items: "항목 보이기",
    hide_items: "항목 숨기기",
    show_chat: "채팅 보이기",
    hide_chat: "채팅 숨기기",
    category_name: "카테고리 이름",
    edit: "수정",
    delete: "삭제",
    cancel: "취소",
    grid_on: "격자: 켬",
    grid_off: "격자: 끔",
    labels_on: "라벨: 켬",
    labels_off: "라벨: 끔",
    no_categories: "카테고리가 없습니다.",

    items_title: "항목",
    slam_start: "SLAM 시작점",

    create_item: "항목 생성",
    edit_item: "항목 수정",
    name: "이름",
    type: "유형",
    heading: "방향°",
    set_from_map: "맵에서 설정",
    image: "이미지",
    upload: "업로드",
    price: "가격",
    sale_percent: "할인 %",
    sale_ends: "할인 종료",
    note: "메모",
    description: "설명",
    save_btn: "저장",
    update_btn: "업데이트",
    close_btn: "닫기",
    tip_edit: "팁: 항목을 눌러 수정하세요.",
    tip_create: "팁: 맵을 눌러 위치를 설정하세요.",
  },
};

const I18nContext = createContext({ lang: 'ko', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ko');
  const t = useMemo(() => (key) => {
    const dict = STRINGS[lang] || STRINGS.ko;
    return dict[key] || STRINGS.en[key] || key;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang: (l) => { localStorage.setItem('lang', l); setLang(l); }, t }), [lang, t]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() { return useContext(I18nContext); }
