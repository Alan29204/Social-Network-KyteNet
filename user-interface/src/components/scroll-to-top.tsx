import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const profileRegex = /^\/profile\/([^/]+)/;
    const matchCurrent = pathname.match(profileRegex);
    const matchPrev = prevPathname.current.match(profileRegex);

    // Bỏ qua việc cuộn lên đầu trang nếu chỉ là chuyển tab trong cùng một profile
    const isProfileTabSwitch = 
      matchCurrent && 
      matchPrev && 
      matchCurrent[1] === matchPrev[1];

    if (!isProfileTabSwitch) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    prevPathname.current = pathname;
  }, [pathname]);

  return null;
}
