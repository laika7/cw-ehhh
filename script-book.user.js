// ==UserScript==
// @name         Показ заброненных запросов
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Показывает забронированные запросы и пометки к ним с информацией
// @author       Мыша
// @match        https://catwar.su/plak*
// @match        https://catwar.net/plak*
// @downloadURL  https://raw.githubusercontent.com/laika7/cw-ehhh/main/script-book.user.js
// @updateURL    https://raw.githubusercontent.com/laika7/cw-ehhh/main/script-book.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function parseBookingTime(timeStr) {
        const now = new Date();
        const mskOffset = 3;
        const localOffset = -now.getTimezoneOffset() / 60;
        const offsetDiff = mskOffset - localOffset;
        const mskNow = new Date(now.getTime() + offsetDiff * 60 * 60 * 1000);
        const currentYear = mskNow.getFullYear();

        const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

        let dateMatch = timeStr.match(/(\d+)\s+([а-я]+)\s+(\d{4})\s+[в]\s+(\d+):(\d+)/i);
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const monthName = dateMatch[2];
            const year = parseInt(dateMatch[3]);
            const hour = parseInt(dateMatch[4]);
            const minute = parseInt(dateMatch[5]);
            const monthIndex = monthNames.findIndex(m => monthName.includes(m));

            if (monthIndex !== -1) {
                const bookedDate = new Date(year, monthIndex, day, hour, minute, 0, 0);
                let diffMinutes = Math.floor((mskNow - bookedDate) / (1000 * 60));
                return Math.max(0, diffMinutes);
            }
        }

        dateMatch = timeStr.match(/(\d+)\s+([а-я]+)\s+[в]\s+(\d+):(\d+)/i);
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const monthName = dateMatch[2];
            const hour = parseInt(dateMatch[3]);
            const minute = parseInt(dateMatch[4]);
            const monthIndex = monthNames.findIndex(m => monthName.includes(m));

            if (monthIndex !== -1) {
                let bookedDate = new Date(currentYear, monthIndex, day, hour, minute, 0, 0);
                let diffMinutes = Math.floor((mskNow - bookedDate) / (1000 * 60));

                if (diffMinutes < 0) {
                    bookedDate = new Date(currentYear - 1, monthIndex, day, hour, minute, 0, 0);
                    diffMinutes = Math.floor((mskNow - bookedDate) / (1000 * 60));
                }
                return Math.max(0, diffMinutes);
            }
        }

        if (timeStr.includes('сегодня')) {
            const timeMatch = timeStr.match(/(\d+):(\d+)/);
            if (timeMatch) {
                const bookedHour = parseInt(timeMatch[1]);
                const bookedMinute = parseInt(timeMatch[2]);
                let bookedDate = new Date(mskNow);
                bookedDate.setHours(bookedHour, bookedMinute, 0, 0);
                if (bookedDate > mskNow) {
                    bookedDate.setDate(bookedDate.getDate() - 1);
                }
                return Math.floor((mskNow - bookedDate) / (1000 * 60));
            }
        }

        if (timeStr.includes('вчера')) {
            const timeMatch = timeStr.match(/(\d+):(\d+)/);
            if (timeMatch) {
                const bookedHour = parseInt(timeMatch[1]);
                const bookedMinute = parseInt(timeMatch[2]);
                let bookedDate = new Date(mskNow);
                bookedDate.setDate(mskNow.getDate() - 1);
                bookedDate.setHours(bookedHour, bookedMinute, 0, 0);
                return Math.floor((mskNow - bookedDate) / (1000 * 60));
            }
        }

        const minuteMatch = timeStr.match(/(\d+)\s*минут/);
        if (minuteMatch) return parseInt(minuteMatch[1]);

        const hourMatch = timeStr.match(/(\d+)\s*час/);
        if (hourMatch) return parseInt(hourMatch[1]) * 60;

        return 0;
    }

    function getAgeCategory(minutes) {
        if (minutes < 60) return 'менее часа';
        if (minutes < 120) return '1 час';
        if (minutes < 180) return '2 часа';
        if (minutes < 1440) {
            const hours = Math.floor(minutes / 60);
            if (hours % 10 === 1 && hours % 100 !== 11) return `${hours} час`;
            if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) return `${hours} часа`;
            return `${hours} часов`;
        }

        const days = Math.floor(minutes / 1440);
        if (days % 10 === 1 && days % 100 !== 11) return `${days} день`;
        if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return `${days} дня`;
        return `${days} дней`;
    }

    function processBookedMessages() {
        const pToggles = document.querySelectorAll('.p_toggle');
        pToggles.forEach(toggle => {
            const parentDiv = toggle.closest('div');
            if (!parentDiv) return;

            const messagesDiv = parentDiv.querySelector('.messages');
            if (!messagesDiv) return;

            const hasBooking = messagesDiv.innerText.includes('Забронировал');

            if (hasBooking) {
                toggle.style.background = 'RGBA(255, 255, 102, 0.18)';
                const existingMarker = toggle.querySelector('.booked-marker');
                if (existingMarker) return;

                const marker = document.createElement('span');
                marker.className = 'booked-marker';
                marker.style.display = 'inline-block';
                marker.style.width = '10px';
                marker.style.height = '10px';
                marker.style.backgroundColor = '#000000';
                marker.style.marginRight = '8px';
                marker.style.borderRadius = '2px';
                marker.style.flexShrink = '0';
                marker.style.cursor = 'pointer';

                let bookingInfo = '';
                let bookingTime = '';
                let totalMinutes = 0;
                const boldText = messagesDiv.innerHTML;
                const bookingMatch = boldText.match(/Забронировал\(а\)\s+<a\s+href="\/cat\d+">([^<]+)<\/a>\s+([^<|]+?)(?:\s*[|<]|\s*$)/);

                if (bookingMatch && bookingMatch[1] && bookingMatch[2]) {
                    bookingInfo = bookingMatch[1];
                    bookingTime = bookingMatch[2].trim();
                    totalMinutes = parseBookingTime(bookingTime);
                } else {
                    const plainMatch = messagesDiv.innerText.match(/Забронировал\(а\)\s+([^\s]+)\s+(.+?)(?:\s*[|<]|\s*$)/);
                    if (plainMatch && plainMatch[1]) {
                        bookingInfo = plainMatch[1];
                        bookingTime = plainMatch[2] ? plainMatch[2].trim() : '';
                        totalMinutes = parseBookingTime(bookingTime);
                    }
                }

                const ageCategory = getAgeCategory(totalMinutes);
                const isRed = totalMinutes >= 120;
                if (bookingInfo) {
                    marker.title = `Забронировано: ${bookingInfo}\nВремя: ${bookingTime}\nВисит бронь: ${ageCategory}`;
                } else {
                    marker.title = 'Забронировано';
                }

                if (isRed) {
                    const ageSpan = document.createElement('span');
                    ageSpan.className = 'booking-age';
                    ageSpan.style.fontSize = '11px';
                    ageSpan.style.fontWeight = 'bold';
                    ageSpan.style.marginLeft = '8px';
                    ageSpan.style.color = '#ff4444';
                    ageSpan.textContent = `(${ageCategory})`;
                    toggle.appendChild(ageSpan);
                }

                const firstBold = toggle.querySelector('b');
                if (firstBold) {
                    firstBold.insertBefore(marker, firstBold.firstChild);
                }
            }
        });
    }

    processBookedMessages();

    const observer = new MutationObserver(function(mutations) {
        processBookedMessages();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
