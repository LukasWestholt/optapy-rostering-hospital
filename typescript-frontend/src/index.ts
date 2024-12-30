import {Timeline, TimelineOptions} from 'vis-timeline';
import {DataSet} from 'vis-data';

import {ScheduleApi, ShiftModel} from './api';

// Import the CSS styles from the installed npm packages
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const api = new ScheduleApi();

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function DateToString(date: Date): String {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


let autoRefreshIntervalId: number | null = null;
const zoomMin = 2 * 1000 * 60 * 60 * 24; // 2 day in milliseconds
const zoomMax = 4 * 7 * 1000 * 60 * 60 * 24; // 4 weeks in milliseconds

const byEmployeePanel = document.getElementById("byEmployeePanel") as HTMLElement;
const byEmployeeTimelineOptions: TimelineOptions = {
    timeAxis: {scale: "hour", step: 6},
    orientation: {axis: "top"},
    stack: false,
    xss: {disabled: true}, // Items are XSS safe through JQuery
    zoomMin: zoomMin,
    zoomMax: zoomMax,
};
let byEmployeeGroupDataSet: DataSet<any, any> = new DataSet();
let byEmployeeItemDataSet: DataSet<any, any> = new DataSet();
let byEmployeeTimeline: Timeline = new Timeline(byEmployeePanel, byEmployeeItemDataSet, byEmployeeGroupDataSet, byEmployeeTimelineOptions);

const byLocationPanel = document.getElementById("byLocationPanel") as HTMLElement;
const byLocationTimelineOptions: TimelineOptions = byEmployeeTimelineOptions && {
    stack: undefined,
};
let byLocationGroupDataSet: DataSet<any, any> = new DataSet();
let byLocationItemDataSet: DataSet<any, any> = new DataSet();
let byLocationTimeline = new Timeline(byLocationPanel, byLocationItemDataSet, byLocationGroupDataSet, byLocationTimelineOptions);

const today = new Date();
byEmployeeTimeline.addCustomTime(today, 'published');
//byEmployeeTimeline.setCustomTimeMarker('Published Shifts', 'published', false);
byEmployeeTimeline.setCustomTimeTitle('Published Shifts', 'published');

byEmployeeTimeline.addCustomTime(today, 'draft');
//byEmployeeTimeline.setCustomTimeMarker('Draft Shifts', 'draft', false);
byEmployeeTimeline.setCustomTimeTitle('Draft Shifts', 'draft');

byLocationTimeline.addCustomTime(today, 'published');
//byLocationTimeline.setCustomTimeMarker('Published Shifts', 'published', false);
byLocationTimeline.setCustomTimeTitle('Published Shifts', 'published');

byLocationTimeline.addCustomTime(today, 'draft');
//byLocationTimeline.setCustomTimeMarker('Draft Shifts', 'draft', false);
byLocationTimeline.setCustomTimeTitle('Draft Shifts', 'draft');

document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#refreshButton")?.addEventListener("click", refreshSchedule);
    document.querySelector("#solveButton")?.addEventListener("click", solve);
    document.querySelector("#stopSolvingButton")?.addEventListener("click", stopSolving);
    document.querySelector("#publish")?.addEventListener("click", publish);

    // HACK to allow vis-timeline to work within Bootstrap tabs
    document.querySelector("#byEmployeePanelTab")?.addEventListener('shown.bs.tab', () => {
        byEmployeeTimeline.redraw();
    });
    document.querySelector("#byLocationPanelTab")?.addEventListener('shown.bs.tab', () => {
        byLocationTimeline.redraw();
    });

    refreshSchedule();
});

function getAvailabilityColor(availabilityType: string): string {
    switch (availabilityType) {
        case 'DESIRED':
            return ' #73d216'; // Tango Chameleon

        case 'UNDESIRED':
            return ' #f57900'; // Tango Orange

        case 'UNAVAILABLE':
            return ' #ef2929 '; // Tango Scarlet Red

        default:
            throw new Error('Unknown availability type: ' + availabilityType);
    }
}

function getShiftColor(shift: ShiftModel, availabilityMap: Map<string, string>): string {
    const shiftDate = DateToString(shift.start);
    console.log(availabilityMap); // TODO
    const mapKey = (shift.employee?.name ?? "unknown") + '-' + shiftDate;
    if (availabilityMap.has(mapKey)) {
        return getAvailabilityColor(availabilityMap.get(mapKey) as string);
    } else {
        return " #729fcf"; // Tango Sky Blue
    }
}

async function refreshSchedule() {
    try {
        const schedule = await api.getScheduleScheduleGet();
        console.log(schedule);
        refreshSolvingButtons(schedule.solverStatus != null && schedule.solverStatus !== "NOT_SOLVING");
            const scoreElement = document.querySelector("#score");
            if (scoreElement) {
                scoreElement.textContent = "Score: " + (schedule.score == null ? "?" : schedule.score);
            }

            const unassignedShifts = document.querySelector("#unassignedShifts") as HTMLElement;
            const groups: string[] = [];
            const availabilityMap = new Map<string, string>();

            // Show only first 7 days of draft
            const scheduleStart = schedule.scheduleState.firstDraftDate;
            const scheduleEnd = DateToString(addDays(scheduleStart, 7));

            unassignedShifts.innerHTML = '';
            let unassignedShiftsCount = 0;
            byEmployeeGroupDataSet.clear();
            byLocationGroupDataSet.clear();

            byEmployeeItemDataSet.clear();
            byLocationItemDataSet.clear();

            byEmployeeTimeline.setCustomTime(schedule.scheduleState.lastHistoricDate, 'published');
            byEmployeeTimeline.setCustomTime(schedule.scheduleState.firstDraftDate, 'draft');

            byLocationTimeline.setCustomTime(schedule.scheduleState.lastHistoricDate, 'published');
            byLocationTimeline.setCustomTime(schedule.scheduleState.firstDraftDate, 'draft');

            schedule.availabilityList.forEach((availability, index) => {
                const availabilityDate = availability.date;
                const start = DateToString(availabilityDate);
                const end = DateToString(addDays(availabilityDate, 1));
                const byEmployeeShiftElement = document.createElement('div');
                const h5 = document.createElement('h5');
                h5.className = "card-title mb-1";
                h5.textContent = availability.availabilityType;
                byEmployeeShiftElement.appendChild(h5);

                const mapKey = availability.employee.name + '-' + DateToString(availabilityDate);
                availabilityMap.set(mapKey, availability.availabilityType);

                byEmployeeItemDataSet.add({
                    id: 'availability-' + index,
                    group: availability.employee.name,
                    content: byEmployeeShiftElement.outerHTML,
                    start: start,
                    end: end,
                    type: "background",
                    style: "opacity: 0.5; background-color: " + getAvailabilityColor(availability.availabilityType),
                });
            });

            schedule.employeeList.forEach((employee) => {
                const employeeGroupElement = document.createElement('div');
                employeeGroupElement.className = "card-body p-2";
                const h5 = document.createElement('h5');
                h5.className = "card-title mb-2";
                h5.textContent = employee.name;
                employeeGroupElement.appendChild(h5);

                const skillSet = employee.skillSet.map(skill => {
                    const span = document.createElement('span');
                    span.className = "badge mr-1 mt-1";
                    span.style.backgroundColor = "#d3d7cf";
                    span.textContent = skill;
                    return span;
                });
                const skillsDiv = document.createElement('div');
                skillSet.forEach(skill => skillsDiv.appendChild(skill));
                employeeGroupElement.appendChild(skillsDiv);

                byEmployeeGroupDataSet.add({id: employee.name, content: employeeGroupElement.outerHTML});
            });

            schedule.shiftList.forEach((shift, index) => {
                if (groups.indexOf(shift.location) === -1) {
                    groups.push(shift.location);
                    byLocationGroupDataSet.add({
                        id: shift.location,
                        content: shift.location,
                    });
                }

                if (shift.employee == null) {
                    unassignedShiftsCount++;

                    const byLocationShiftElement = document.createElement('div');
                    byLocationShiftElement.className = "card-body p-2";
                    const h5 = document.createElement('h5');
                    h5.className = "card-title mb-2";
                    h5.textContent = "Unassigned";
                    byLocationShiftElement.appendChild(h5);

                    const skillsDiv = document.createElement('div');
                    shift.requiredSkills.forEach(skill => {
                        const span = document.createElement('span');
                        span.className = "badge mr-1 mt-1";
                        span.style.backgroundColor = "#d3d7cf";
                        span.textContent = skill;
                        skillsDiv.appendChild(span);
                    });
                    byLocationShiftElement.appendChild(skillsDiv);

                    byLocationItemDataSet.add({
                        id: 'shift-' + index, group: shift.location,
                        content: byLocationShiftElement.outerHTML,
                        start: shift.start, end: shift.end,
                        style: "background-color: #EF292999"
                    });
                } else {
                    const allSkillsMatch = shift.requiredSkills.every(skill =>
                        shift.employee?.skillSet.includes(skill)
                    );
                    const skillColor = (!allSkillsMatch ? '#ef2929' : '#8ae234');
                    const byEmployeeShiftElement = document.createElement('div');
                    byEmployeeShiftElement.className = "card-body p-2";
                    const h5Employee = document.createElement('h5');
                    h5Employee.className = "card-title mb-2";
                    h5Employee.textContent = shift.location;
                    byEmployeeShiftElement.appendChild(h5Employee);

                    const skillsDiv = document.createElement('div');
                    shift.requiredSkills.forEach(skill => {
                        const span = document.createElement('span');
                        span.className = "badge mr-1 mt-1";
                        span.style.backgroundColor = skillColor;
                        span.textContent = skill;
                        skillsDiv.appendChild(span);
                    });
                    byEmployeeShiftElement.appendChild(skillsDiv);

                    const byLocationShiftElement = document.createElement('div');
                    byLocationShiftElement.className = "card-body p-2";
                    const h5Location = document.createElement('h5');
                    h5Location.className = "card-title mb-2";
                    h5Location.textContent = shift.employee.name;
                    byLocationShiftElement.appendChild(h5Location);

                    const shiftColor = getShiftColor(shift, availabilityMap);
                    byEmployeeItemDataSet.add({
                        id: 'shift-' + index, group: shift.employee.name,
                        content: byEmployeeShiftElement.outerHTML,
                        start: shift.start, end: shift.end,
                        style: "background-color: " + shiftColor
                    });
                    byLocationItemDataSet.add({
                        id: 'shift-' + index, group: shift.location,
                        content: byLocationShiftElement.outerHTML,
                        start: shift.start, end: shift.end,
                        style: "background-color: " + shiftColor
                    });
                }
            });

            if (unassignedShiftsCount === 0) {
                unassignedShifts.appendChild(document.createElement('p')).textContent = "There are no unassigned shifts.";
            } else {
                unassignedShifts.appendChild(document.createElement('p')).textContent = `There are ${unassignedShiftsCount} unassigned shifts.`;
            }

            byEmployeeTimeline.setWindow(scheduleStart, scheduleEnd);
            byLocationTimeline.setWindow(scheduleStart, scheduleEnd);
    } catch (error) {
        console.error('Error fetching schedule:', error);
    }
}

function solve() {
    api.solveSolvePost()
        .then(() => {
            refreshSolvingButtons(true);
        })
        .catch((err) => {
            showError("Start solving failed.", err);
        });
}

function publish() {
    api.publishPublishPost()
        .then(() => {
            refreshSolvingButtons(true);
        })
        .catch((err) => {
            showError("Publish failed.", err);
        });
}

function refreshSolvingButtons(solving: boolean) {
    const solveButton = document.querySelector("#solveButton");
    const stopSolvingButton = document.querySelector("#stopSolvingButton");
    if (solving) {
        solveButton?.classList.add('hidden');
        stopSolvingButton?.classList.remove('hidden');
        if (autoRefreshIntervalId == null) {
            autoRefreshIntervalId = setInterval(refreshSchedule, 2000);
        }
    } else {
        solveButton?.classList.remove('hidden');
        stopSolvingButton?.classList.add('hidden');
        if (autoRefreshIntervalId != null) {
            clearInterval(autoRefreshIntervalId);
            autoRefreshIntervalId = null;
        }
    }
}

async function stopSolving() {
    api.stopSolvingStopSolvingPost()
        .then(() => {
            refreshSolvingButtons(false);
            refreshSchedule();
        })
        .catch((err) => {
            showError("Stop solving failed.", err);
        });
}

function showError(title: string, err: any) {
    const errorMessage = err.message || `${err.status}: ${err.statusText}`;
    console.error(`${title}\n${errorMessage}`);
    const notification = document.createElement('div');
    notification.classList.add('toast');
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');
    notification.setAttribute('aria-atomic', 'true');
    notification.style.minWidth = '30rem';

    const toastHeader = document.createElement('div');
    toastHeader.classList.add('toast-header', 'bg-danger');
    const strong = document.createElement('strong');
    strong.classList.add('mr-auto', 'text-dark');
    strong.textContent = "Error";
    toastHeader.appendChild(strong);

    const closeButton = document.createElement('button');
    closeButton.classList.add('ml-2', 'mb-1', 'close');
    closeButton.setAttribute('data-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '&times;';
    toastHeader.appendChild(closeButton);

    const toastBody = document.createElement('div');
    toastBody.classList.add('toast-body');
    toastBody.innerHTML = `<p>${title}</p><pre><code>${errorMessage}</code></pre>`;
    notification.appendChild(toastHeader);
    notification.appendChild(toastBody);

    document.querySelector("#notificationPanel")?.appendChild(notification);

    // You may need a toast library to show this toast (like Bootstrap JS)
    // For now, we simulate showing it
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
}
