from domain import Employee, Shift, Availability, AvailabilityType, ScheduleState, EmployeeSchedule
import datetime
from random import Random
from optapy import solver_manager_create, score_manager_create
import optapy.config
from optapy.types import Duration, SolverStatus
from optapy.score import HardSoftScore
from constraints import employee_scheduling_constraints
from typing import Optional
from flask import Flask, jsonify

app = Flask(__name__)


def next_weekday(d, weekday):
    days_ahead = weekday - d.weekday()
    if days_ahead <= 0:  # Target day already happened this week
        days_ahead += 7
    return d + datetime.timedelta(days_ahead)


FIRST_NAMES = ["Amy", "Beth", "Chad", "Dan", "Elsa", "Flo", "Gus", "Hugo", "Ivy", "Jay", "Kate", "Lisa", "Mary", "Nina",
               "Olivia", "Pat"]
LAST_NAMES = ["Cole", "Fox", "Green", "Jones", "King", "Li", "Poe", "Rye", "Smith", "Watt", "Xavier", "Yang", "Zhang", "Müller", "Schmidt", "Schneider"]

LOCATION_SHIFT_EMPLOYEE_COUNT = {
    "Notaufnahme": 1,
    "Normalstation": 5,
    "Intensivstation": 1,
    "Visitendienst": 1,
}

REQUIRED_SKILLS = list(LOCATION_SHIFT_EMPLOYEE_COUNT.keys())
OPTIONAL_SKILLS = []
EMPLOYEE_COUNT = 16

SHIFT = {
    "Notaufnahme": [
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=45)),
            (datetime.time(hour=12), datetime.timedelta(hours=9)),
            (datetime.time(hour=19, minute=45), datetime.timedelta(hours=12, minutes=45)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=45)),
            (datetime.time(hour=12), datetime.timedelta(hours=9)),
            (datetime.time(hour=19, minute=45), datetime.timedelta(hours=12, minutes=45)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=45)),
            (datetime.time(hour=12), datetime.timedelta(hours=9)),
            (datetime.time(hour=19, minute=45), datetime.timedelta(hours=12, minutes=45)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=45)),
            (datetime.time(hour=12), datetime.timedelta(hours=9)),
            (datetime.time(hour=19, minute=45), datetime.timedelta(hours=12, minutes=45)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=12, minutes=30)),
            (datetime.time(hour=20), datetime.timedelta(hours=12, minutes=30)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=12, minutes=30)),
            (datetime.time(hour=20), datetime.timedelta(hours=12, minutes=30)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=12, minutes=30)),
            (datetime.time(hour=20), datetime.timedelta(hours=12, minutes=30)),
        ]
    ],
    "Normalstation": [
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=30)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=30)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=30)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=30)),
        ],
        [
            (datetime.time(hour=8), datetime.timedelta(hours=8, minutes=30)),
        ],
        [],
        []
    ],
    "Visitendienst": [
        [],
        [],
        [],
        [],
        [],
        [
            (datetime.time(hour=10), datetime.timedelta(hours=6)),
        ],
        [
            (datetime.time(hour=10), datetime.timedelta(hours=6)),
        ]
    ],
    "Intensivstation": [
        [
            (datetime.time(hour=7, minute=30), datetime.timedelta(hours=12, minutes=45)),
        ],
        [
            (datetime.time(hour=7, minute=30), datetime.timedelta(hours=9)),
        ],
        [
            (datetime.time(hour=19, minute=30), datetime.timedelta(hours=12, minutes=45)),
        ]
    ]
}

id_generator = 0
schedule: Optional[EmployeeSchedule] = None


def generate_demo_data():
    global schedule
    INITIAL_ROSTER_LENGTH_IN_DAYS = 14
    START_DATE = next_weekday(datetime.date.today(), 0)  # next Monday

    schedule_state = ScheduleState()
    schedule_state.first_draft_date = START_DATE
    schedule_state.draft_length = INITIAL_ROSTER_LENGTH_IN_DAYS
    schedule_state.publish_length = 7
    schedule_state.last_historic_date = START_DATE

    random = Random(0)
    name_permutations = join_all_combinations(FIRST_NAMES, LAST_NAMES)
    random.shuffle(name_permutations)

    employee_list = []
    for i in range(EMPLOYEE_COUNT):
        skills = pick_subset(OPTIONAL_SKILLS, random, 1, 3)
        skills.append(pick_random(REQUIRED_SKILLS, random))
        employee = Employee()
        employee.name = name_permutations[i]
        employee.skill_set = skills
        employee_list.append(employee)

    shift_list = []
    availability_list = []
    for i in range(INITIAL_ROSTER_LENGTH_IN_DAYS):
        employees_with_availabilities_on_day = pick_subset(employee_list, random, 4, 3, 2, 1)
        date = START_DATE + datetime.timedelta(days=i)
        for employee in employees_with_availabilities_on_day:
            availability_type = pick_random(AvailabilityType.list(), random)
            availability = Availability()
            availability.date = date
            availability.employee = employee
            availability.availability_type = availability_type
            availability_list.append(availability)
        shift_list.extend(generate_shifts_for_day(date, random))
    schedule = EmployeeSchedule(
        schedule_state,
        availability_list,
        employee_list,
        shift_list,
        None
    )


def generate_shifts_for_day(date: datetime.date, random: Random):
    out = []
    for location, shift_times_list in SHIFT.items():
        if len(shift_times_list) == 7:
            shift_times = shift_times_list[date.weekday()]
        else:
            shift_times = pick_random(shift_times_list, random)
        for shift_start_time, shift_duration in shift_times:
            shift_start_date_time = datetime.datetime.combine(date, shift_start_time)
            shift_end_date_time = shift_start_date_time + shift_duration
            out.extend(list(generate_shift_for_timeslot(shift_start_date_time, shift_end_date_time, location, LOCATION_SHIFT_EMPLOYEE_COUNT[location])))
    return out


def generate_shift_for_timeslot(timeslot_start: datetime.datetime, timeslot_end: datetime.datetime,
                                location: str, times: int = 1):
    global id_generator
    for i in range(times):
        shift = Shift()
        shift.id = id_generator
        shift.start = timeslot_start
        shift.end = timeslot_end
        shift.required_skills = [location]
        shift.location = location
        shift.employee = None
        id_generator += 1
        yield shift


def generate_draft_shifts():
    global schedule
    random = Random(0)
    for i in range(schedule.schedule_state.publish_length):
        employees_with_availabilities_on_day = pick_subset(schedule.employee_list, random, 4, 3, 2, 1)
        date = schedule.schedule_state.first_draft_date + datetime.timedelta(days=(schedule.schedule_state.publish_length + i))
        for employee in employees_with_availabilities_on_day:
            availability_type = pick_random(AvailabilityType.list(), random)
            availability = Availability()
            availability.date = date
            availability.employee = employee
            availability.availability_type = availability_type
            schedule.availability_list.append(availability)
        schedule.shift_list.extend(generate_shifts_for_day(date, random))


def pick_random(source: list, random: Random):
    return random.choice(source)


def pick_subset(source: list, random: Random, *distribution: int):
    if not source:
        return []
    item_count = random.choices(range(len(distribution)), distribution)
    return random.sample(source, item_count[0])


def join_all_combinations(*part_arrays: list[str]):
    if len(part_arrays) == 0:
        return []
    if len(part_arrays) == 1:
        return part_arrays[0]
    combinations = []
    for combination in join_all_combinations(*part_arrays[1:]):
        for item in part_arrays[0]:
            combinations.append(f'{item} {combination}')
    return combinations


SINGLETON_ID = 1
solver_config = optapy.config.solver.SolverConfig()
# noinspection PyTypeChecker
solver_config\
    .withSolutionClass(EmployeeSchedule)\
    .withEntityClasses(Shift)\
    .withConstraintProviderClass(employee_scheduling_constraints)\
    .withTerminationSpentLimit(Duration.ofSeconds(60))

solver_manager = solver_manager_create(solver_config)
score_manager = score_manager_create(solver_manager)
last_score = HardSoftScore.ZERO


@app.route('/schedule')
def get_schedule():
    global schedule
    solver_status = get_solver_status()
    solution = schedule
    score = score_manager.updateScore(solution)
    solution.solver_status = solver_status
    solution.score = score
    return jsonify(solution.to_dict())


def get_solver_status():
    return solver_manager.getSolverStatus(SINGLETON_ID)


def error_handler(problem_id, exception):
    print(f'an exception occurred solving {problem_id}: {exception.getMessage()}')
    exception.printStackTrace()


@app.route('/solve', methods=['POST'])
def solve():
    solver_manager.solveAndListen(SINGLETON_ID, find_by_id, save, error_handler)
    return dict()


@app.route('/publish', methods=['POST'])
def publish():
    global schedule
    if get_solver_status() != SolverStatus.NOT_SOLVING:
        raise RuntimeError('Cannot publish a schedule while solving in progress.')
    schedule_state = schedule.schedule_state
    new_historic_date = schedule_state.first_draft_date
    new_draft_date = schedule_state.first_draft_date + datetime.timedelta(days=schedule_state.publish_length)

    schedule_state.last_historic_date = new_historic_date
    schedule_state.first_draft_date = new_draft_date

    generate_draft_shifts()
    return dict()


@app.route('/stopSolving', methods=['POST'])
def stop_solving():
    solver_manager.terminateEarly(SINGLETON_ID)
    return dict()


def find_by_id(schedule_id):
    global schedule
    if schedule_id != SINGLETON_ID:
        raise ValueError(f'There is no schedule with id ({schedule_id})')
    return schedule


def save(solution):
    global schedule
    schedule = solution