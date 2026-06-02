import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export const formatTimeAgo = (dateString: string | Date | undefined) => {
  if (!dateString) return '';
  
  let dateToParse = dateString;
  
  if (typeof dateString === 'string') {
    // Nếu chuỗi thời gian không có đuôi Z (báo hiệu UTC) thì thêm vào
    if (!dateString.endsWith('Z')) {
      dateToParse = dateString + 'Z';
    }
  }

  try {
    let result = formatDistanceToNow(new Date(dateToParse), { addSuffix: true, locale: vi });
    result = result.replace(/^khoảng /, '').replace(/^dưới /, '');
    return result;
  } catch (e) {
    return '';
  }
};
