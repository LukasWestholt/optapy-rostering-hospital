import * as JSJoda from '@js-joda/core';
import {Timeline, TimelineOptions} from 'vis-timeline';
import {DataSet} from 'vis-data';

import { ScheduleApi } from './api';

const api = new ScheduleApi();

async function refreshSchedule() {
    try {
        const schedule = await api.getSchedule();
        console.log(schedule);
        // Verarbeiten Sie die Daten wie zuvor
    } catch (error) {
        console.error('Error fetching schedule:', error);
    }
}

document.getElementById('refreshButton').addEventListener('click', refreshSchedule);

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
let windowStart = JSJoda.LocalDate.now().toString();
let windowEnd = JSJoda.LocalDate.parse(windowStart).plusDays(7).toString();

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

// Use fetch to set headers for all future requests
const setDefaultHeaders = () => {
    return new Headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    });
};

// Replacing jQuery's custom put and delete with fetch
const customFetch = (url: string, method: string, data?: any) => {
    const headers = setDefaultHeaders();
    const requestOptions: RequestInit = {
        method: method,
        headers: headers,
        body: data ? JSON.stringify(data) : null
    };
    return fetch(url, requestOptions).then(response => response.json());
};

document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#refreshButton")?.addEventListener("click", () => {
        refreshSchedule();
    });
    document.querySelector("#solveButton")?.addEventListener("click", () => {
        solve();
    });
    document.querySelector("#stopSolvingButton")?.addEventListener("click", () => {
        stopSolving();
    });
    document.querySelector("#publish")?.addEventListener("click", () => {
        publish();
    });

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

function getShiftColor(shift: any, availabilityMap: Map<string, string>): string {
    const shiftDate = JSJoda.LocalDateTime.parse(shift.start).toLocalDate().toString();
    const mapKey = shift.employee.name + '-' + shiftDate;
    if (availabilityMap.has(mapKey)) {
        return getAvailabilityColor(availabilityMap.get(mapKey) as string);
    } else {
        return " #729fcf"; // Tango Sky Blue
    }
}

function refreshSchedule() {
    fetch("/schedule")
        .then(response => response.json())
        .then(schedule => {
            refreshSolvingButtons(schedule.solver_status != null && schedule.solver_status !== "NOT_SOLVING");
            const scoreElement = document.querySelector("#score");
            if (scoreElement) {
                scoreElement.textContent = "Score: " + (schedule.score == null ? "?" : schedule.score);
            }

            const unassignedShifts = document.querySelector("#unassignedShifts") as HTMLElement;
            const groups: string[] = [];
            const availabilityMap = new Map<string, string>();

            // Show only first 7 days of draft
            const scheduleStart = schedule.schedule_state.first_draft_date;
            const scheduleEnd = JSJoda.LocalDate.parse(scheduleStart).plusDays(7).toString();

            windowStart = scheduleStart;
            windowEnd = scheduleEnd;

            unassignedShifts.innerHTML = '';
            let unassignedShiftsCount = 0;
            byEmployeeGroupDataSet.clear();
            byLocationGroupDataSet.clear();

            byEmployeeItemDataSet.clear();
            byLocationItemDataSet.clear();

            byEmployeeTimeline.setCustomTime(schedule.schedule_state.last_historic_date, 'published');
            byEmployeeTimeline.setCustomTime(schedule.schedule_state.first_draft_date, 'draft');

            byLocationTimeline.setCustomTime(schedule.schedule_state.last_historic_date, 'published');
            byLocationTimeline.setCustomTime(schedule.schedule_state.first_draft_date, 'draft');

            schedule.availability_list.forEach((availability, index) => {
                const availabilityDate = JSJoda.LocalDate.parse(availability.date);
                const start = availabilityDate.atStartOfDay().toString();
                const end = availabilityDate.plusDays(1).atStartOfDay().toString();
                const byEmployeeShiftElement = document.createElement('div');
                const h5 = document.createElement('h5');
                h5.className = "card-title mb-1";
                h5.textContent = availability.availability_type;
                byEmployeeShiftElement.appendChild(h5);

                const mapKey = availability.employee.name + '-' + availabilityDate.toString();
                availabilityMap.set(mapKey, availability.availability_type);

                byEmployeeItemDataSet.add({
                    id: 'availability-' + index,
                    group: availability.employee.name,
                    content: byEmployeeShiftElement.outerHTML,
                    start: start,
                    end: end,
                    type: "background",
                    style: "opacity: 0.5; background-color: " + getAvailabilityColor(availability.availability_type),
                });
            });

            schedule.employee_list.forEach((employee, index) => {
                const employeeGroupElement = document.createElement('div');
                employeeGroupElement.className = "card-body p-2";
                const h5 = document.createElement('h5');
                h5.className = "card-title mb-2";
                h5.textContent = employee.name;
                employeeGroupElement.appendChild(h5);

                const skillSet = employee.skill_set.map(skill => {
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

            schedule.shift_list.forEach((shift, index) => {
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
                    shift.required_skills.forEach(skill => {
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
                    const allSkillsMatch = shift.required_skills.every(skill =>
                        shift.employee.skill_set.has(skill)
                    );
                    const skillColor = (!allSkillsMatch ? '#ef2929' : '#8ae234');
                    const byEmployeeShiftElement = document.createElement('div');
                    byEmployeeShiftElement.className = "card-body p-2";
                    const h5Employee = document.createElement('h5');
                    h5Employee.className = "card-title mb-2";
                    h5Employee.textContent = shift.location;
                    byEmployeeShiftElement.appendChild(h5Employee);

                    const skillsDiv = document.createElement('div');
                    shift.required_skills.forEach(skill => {
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
        });
}

function solve() {
    customFetch("/solve", "POST")
        .then(() => {
            refreshSolvingButtons(true);
        })
        .catch((err) => {
            showError("Start solving failed.", err);
        });
}

function publish() {
    customFetch("/publish", "POST")
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

function stopSolving() {
    customFetch("/stopSolving", "POST")
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
