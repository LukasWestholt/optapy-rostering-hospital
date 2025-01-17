from optapy import constraint_provider
from optapy.score import HardSoftScore
from optapy.constraint import Joiners, ConstraintFactory, Constraint

from domain import Shift, Availability, AvailabilityType
from datetime import timedelta, datetime


def get_start_of_availability(availability: Availability):
    return datetime.combine(availability.date, datetime.min.time())


def get_end_of_availability(availability: Availability):
    return datetime.combine(availability.date, datetime.max.time())


def get_minute_overlap(shift1: Shift, shift2: Shift) -> int:
    duration_of_overlap: timedelta = min(shift1.end, shift2.end) - max(shift1.start, shift2.start)
    return int(duration_of_overlap.total_seconds() // 60)


def get_shift_duration_in_minutes(shift: Shift) -> int:
    return int((shift.end - shift.start).total_seconds() // 60)


@constraint_provider
def employee_scheduling_constraints(constraint_factory: ConstraintFactory):
    return [
        required_skill(constraint_factory),
        no_overlapping_shifts(constraint_factory),
        at_least_10_hours_between_two_shifts(constraint_factory),
        one_shift_per_day(constraint_factory),
        unavailable_employee(constraint_factory),
        desired_day_for_employee(constraint_factory),
        undesired_day_for_employee(constraint_factory),
    ]

def required_skill(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each(Shift) \
        .filter(lambda shift: any([skill not in shift.employee.skill_set for skill in shift.required_skills])) \
        .penalize("Missing required skill", HardSoftScore.ONE_HARD)


def no_overlapping_shifts(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each_unique_pair(Shift,
                              Joiners.equal(lambda shift: shift.employee),
                              Joiners.overlapping(lambda shift: shift.start,
                                                  lambda shift: shift.end)
                              ) \
        .penalize("Overlapping shift", HardSoftScore.ONE_HARD, get_minute_overlap)


def at_least_10_hours_between_two_shifts(constraint_factory: ConstraintFactory) -> Constraint:
    ten_hours_in_seconds = 60 * 60 * 10
    return constraint_factory \
        .for_each_unique_pair(Shift,
                              Joiners.equal(lambda shift: shift.employee),
                              Joiners.less_than_or_equal(lambda shift: shift.end,
                                                         lambda shift: shift.start)
                              ) \
        .filter(lambda first_shift, second_shift:
                (second_shift.start - first_shift.end).total_seconds() < ten_hours_in_seconds) \
        .penalize("At least 10 hours between 2 shifts", HardSoftScore.ONE_HARD,
                  lambda first_shift, second_shift:
                  (ten_hours_in_seconds - (second_shift.start - first_shift.end).total_seconds()) // 60)


def one_shift_per_day(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each_unique_pair(Shift,
                              Joiners.equal(lambda shift: shift.employee),
                              Joiners.equal(lambda shift: shift.start.date())
                              ) \
        .penalize("Max one shift per day", HardSoftScore.ONE_HARD)


def unavailable_employee(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each(Shift) \
        .join(Availability,
              Joiners.equal(lambda shift: shift.employee,
                            lambda availability: availability.employee),
              Joiners.equal(lambda shift: shift.start.date(),
                            lambda availability: availability.date)
              ) \
        .filter(lambda shift, availability: availability.availability_type == AvailabilityType.UNAVAILABLE) \
        .penalize('Unavailable employee', HardSoftScore.ONE_HARD,
                  lambda shift, availability: get_shift_duration_in_minutes(shift))


def desired_day_for_employee(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each(Shift) \
        .join(Availability,
              Joiners.equal(lambda shift: shift.employee,
                            lambda availability: availability.employee),
              Joiners.equal(lambda shift: shift.start.date(),
                            lambda availability: availability.date)
              ) \
        .filter(lambda shift, availability: availability.availability_type == AvailabilityType.DESIRED) \
        .reward('Desired day for employee', HardSoftScore.ONE_SOFT,
                lambda shift, availability: get_shift_duration_in_minutes(shift))


def undesired_day_for_employee(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each(Shift) \
        .join(Availability,
              Joiners.equal(lambda shift: shift.employee,
                            lambda availability: availability.employee),
              Joiners.equal(lambda shift: shift.start.date(),
                            lambda availability: availability.date)
              ) \
        .filter(lambda shift, availability: availability.availability_type == AvailabilityType.UNDESIRED) \
        .penalize('Undesired day for employee', HardSoftScore.ONE_SOFT,
                  lambda shift, availability: get_shift_duration_in_minutes(shift))

# TODO
# https://www.optaplanner.org/blog/2021/10/05/ANewAIConstraintSolverForPythonOptaPy.html
# Jeder Employee soll (desired) max. 40h * 4,25 Wochen
# Bei aufeinanderfolgenden Nachtschichten sollen aufeinanderfolgende Erholungstage folgen.
# Maximal vier Nachtschichten nacheinander in der Nofaufnahme
# Maximal drei Nachtschichten nacheinander in der Intensiv
#
# +Unterplanung lassen wir weg
# +Überstundenabbau bei Überplanung

# TODO Die Nachtschicht darf nicht in einen unavilable day ragen!

# Entweder: Kurzer Tagdienst + Nachtdienst
# Oder: Langer Tagdienst
#
# Immer: Kurz- EXK-ODER Lang-Tag-Dienst
# Manchmal: Nachtdienst
# Mo-Do, Fr-So

def sequential_shifts_at_same_location(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each_unique_pair(Shift,
                              Joiners.equal(lambda shift: shift.employee),
                              Joiners.equal(lambda shift: shift.location),
                              Joiners.equal(lambda shift: shift.start.date() + timedelta(days=1),
                                            lambda shift: shift.start.date())
                              ) \
        .reward("Sequential shifts at the same location", HardSoftScore.ONE_SOFT)

def sequential_shifts_at_same_slot(constraint_factory: ConstraintFactory) -> Constraint:
    return constraint_factory \
        .for_each_unique_pair(Shift,
                              Joiners.equal(lambda shift: shift.employee),
                              Joiners.equal(lambda shift: shift.start.time()),
                              Joiners.equal(lambda shift: shift.start.date() + timedelta(days=1),
                                            lambda shift: shift.start.date())
                              ) \
        .reward("Sequential shifts at the same slot", HardSoftScore.ONE_SOFT)
