const axios = require('axios');
const { exec } = require('child_process');

const greenColor = '#40F26A';
const redColor = '#F54263';
const TERMUX_NOTIFICATION = 1;
const API_NOTIFICATION = 2;

const scheduleUrl = 'https://off.energy.mk.ua';
const apiActiveUrl = 'https://off.energy.mk.ua/api/schedule/active';
const apiOutageQueueUrl = 'https://off.energy.mk.ua/api/outage-queue/by-type/3';
const apiTimeSeriesUrl = 'https://off.energy.mk.ua/api/schedule/time-series';
const endpoint = 'http://192.168.0.62:3000';
const groupName = '6.2';
let activeData = '';
let outageQueueData = '';
let timeSeriesData = '';

async function fetchData(url) {
    try {
        const response = await axios.get(url);

        return response.data;
    } catch (error) {
        console.error(`Error fetching the URL: ${url}`);
        console.error(error.message);

        return null;
    }
}

async function fetchAllData() {
    [activeData, outageQueueData, timeSeriesData] = await Promise.all([
        fetchData(apiActiveUrl),
        fetchData(apiOutageQueueUrl),
        fetchData(apiTimeSeriesUrl),
    ]);
}

function addLeadingZeroForTime(time) {
    if (time < 10) {time = '0' + time}
    return time;
}

async function checkSchedule(notificationType) {
    await fetchAllData();

    const groupId = outageQueueData.find(e => e.name == groupName).id;
    const activeForGroupId = activeData.filter(e => e.outage_queue_id == groupId).sort((a,b) => {a.time_series_id - b.time_series_id});
    const currentDatetime = new Date();

    if (activeForGroupId.length == 0) {
        const message = {
            title: 'Вимкнень світла не буде!',
            message: `Станом на ${addLeadingZeroForTime(currentDatetime.getHours())}:${addLeadingZeroForTime(currentDatetime.getMinutes())} для групи ${groupName} немає знеструмлень :D`,
            color: greenColor,
            url: scheduleUrl
        };

        sendNotification(notificationType, message);
    } else {
        const messageBody = '';

        activeForGroupId.forEach(active => {
            const timeObj = timeSeriesData.find(e => e.id == active.time_series_id);
    
            message += `${timeObj.start} - ${timeObj.end}: ${active.type}\n`;
        });

        const message = {
            title: 'Зафіксовано вимкнення для групи!',
            message: `Станом на ${currentDatetime.getHours()}:${currentDatetime.getMinutes()} для групи ${groupName} існують наступні вимкнення:\n${messageBody}`,
            color: redColor,
            url: scheduleUrl
        };

        sendNotification(notificationType, message);
    }
}

function sendNotification(type, message) {
    const currentDatetime = new Date();

    if (type == TERMUX_NOTIFICATION) {
        exec(`termux-notification --title '${message.title}' --content '${message.message}'`, (err, stdout, stderr) => {
            if (err) {
              console.error(`exec error: ${err}`);
              return;
            }

            console.log(`${currentDatetime}: TERMUX_NOTIFICATION: ${message.title}`);
        });
    } else if (type == API_NOTIFICATION) {
        axios.post(endpoint, message)
            .then(() => {
                console.log(`${currentDatetime}: API_NOTIFICATION: ${message.title}`);
            })
            .catch((error) => {
                console.log(error);
            });
    }
}

checkSchedule(parseInt(process.argv[2]));

setInterval(() => {
    checkSchedule(parseInt(process.argv[2]));
}, 30* 60 * 1000);
