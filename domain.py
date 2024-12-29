import optapy.types
import optapy.score
import datetime
import enum

from pydantic import BaseModel


@optapy.problem_fact
class Employee:
    name: str
    skill_set: list[str]

    def __init__(self, name: str, skill_set: list[str]):
        self.name = name
        self.skill_set = skill_set

    def __str__(self):
        return f'Employee(name={self.name})'

class EmployeeModel(BaseModel):
    name: str
    skill_set: list[str]


class AvailabilityType(enum.Enum):
    DESIRED = 'DESIRED'
    UNDESIRED = 'UNDESIRED'
    UNAVAILABLE = 'UNAVAILABLE'


@optapy.problem_fact
class Availability:
    employee: Employee
    date: datetime.date
    availability_type: AvailabilityType

    def __init__(self, employee: Employee, date: datetime.date,
                 availability_type: AvailabilityType):
        self.employee = employee
        self.date = date
        self.availability_type = availability_type

    def __str__(self):
        return f'Availability(employee={self.employee}, date={self.date}, availability_type={self.availability_type})'

class AvailabilityModel(BaseModel):
    employee: EmployeeModel
    date: datetime.date
    availability_type: AvailabilityType

class ScheduleState(BaseModel):
    publish_length: int
    draft_length: int
    first_draft_date: datetime.date
    last_historic_date: datetime.date

    def is_draft(self, shift):
        return shift.start >= datetime.datetime.combine(self.first_draft_date, datetime.time.min)


def shift_pinning_filter(solution, shift):
    return not solution.schedule_state.is_draft(shift)


@optapy.planning_entity(pinning_filter=shift_pinning_filter)
class Shift:
    shift_id: int
    start: datetime.datetime
    end: datetime.datetime
    location: str
    required_skills: list[str]
    employee: Employee | None

    def __init__(self, shift_id, start: datetime.datetime, end: datetime.datetime,
                 location: str, required_skills: list[str], employee: Employee | None = None):
        self.shift_id = shift_id
        self.start = start
        self.end = end
        self.location = location
        self.required_skills = required_skills
        self.employee = employee


    @optapy.planning_id
    def get_id(self):
        return self.shift_id

    @optapy.planning_variable(Employee, value_range_provider_refs=['employee_range'])
    def get_employee(self):
        return self.employee

    def set_employee(self, employee):
        self.employee = employee

    def __str__(self):
        return f'Shift(shift_id={self.shift_id}, start={self.start}, end={self.end}, location={self.location}, ' \
               f'required_skills={self.required_skills}, employee={self.employee})'

class ShiftModel(BaseModel):
    shift_id: int
    start: datetime.datetime
    end: datetime.datetime
    location: str
    required_skills: list[str]
    employee: EmployeeModel | None

@optapy.planning_solution
class EmployeeSchedule:
    schedule_state: ScheduleState
    availability_list: list[Availability]
    employee_list: list[Employee]
    shift_list: list[Shift]
    solver_status: optapy.types.SolverStatus | None
    score: optapy.score.SimpleScore | None

    def __init__(self, schedule_state: ScheduleState, availability_list: list[Availability], employee_list: list[Employee], shift_list: list[Shift], solver_status: optapy.types.SolverStatus | None = None, score: optapy.score.SimpleScore | None = None):
        self.employee_list = employee_list
        self.availability_list = availability_list
        self.schedule_state = schedule_state
        self.shift_list = shift_list
        self.solver_status = solver_status
        self.score = score

    @optapy.problem_fact_collection_property(Employee)
    @optapy.value_range_provider('employee_range')
    def get_employee_list(self):
        return self.employee_list

    @optapy.problem_fact_collection_property(Availability)
    def get_availability_list(self):
        return self.availability_list

    @optapy.planning_entity_collection_property(Shift)
    def get_shift_list(self):
        return self.shift_list

    @optapy.planning_score(optapy.score.HardSoftScore)
    def get_score(self):
        return self.score

    def set_score(self, score):
        self.score = score

class EmployeeScheduleModel(BaseModel):
    schedule_state: ScheduleState
    availability_list: list[AvailabilityModel]
    employee_list: list[EmployeeModel]
    shift_list: list[ShiftModel]
    solver_status: str | None
    score: str | None

    def model_dump(self, **kwargs) -> dict:
        data = super().model_dump(**kwargs)
        if 'solver_status' in data and isinstance(data['solver_status'], optapy.types.SolverStatus):
            data["solver_status"] = self['solver_status'].toString()
        if 'score' in data and isinstance(data['score'], optapy.score.SimpleScore):
            data["score"] = data['score'].toString()
        return data
