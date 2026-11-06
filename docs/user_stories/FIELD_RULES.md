## Field Rules

Given that specifications for valid data on fields are not always explicitly defined in user stories, the following field rules are established to ensure consistency and clarity across the application. These rules apply to all user stories unless otherwise specified.

- **Field Rule 1: Required Fields**
    - All fields marked as required must be filled out before submission.
    - If a required field is left empty, the user must be notified and prevented from submitting the form.
- **Field Rule 2: Field Length**
    - Text fields must have a maximum character limit defined in the specification.
    - If a user exceeds the character limit, they must be notified and prevented from submitting the form.
    - The default maximum character limit for text fields is 25 characters unless otherwise specified in the user story.
- **Field Rule 3: Field Format**
    - Fields must adhere to the specified format (e.g.,mail, string, integer, date).
    - If a user enters data in an incorrect format, they must be notified and prevented from submitting the form.
- **Field Rule 4: Field Uniqueness**
    - Fields that require unique values (e.g., usernames, email addresses) must be checked against existing records.
    - If a user attempts to submit a value that is not unique, they must be notified and prevented from submitting the form.
- **Field Rule 5: Field Validation**
    - All fields must be validated according to the rules defined in the user story or specification.
    - If a field fails validation, the user must be notified and prevented from submitting the form.
- **Field Rule 6: Optional Fields**
    - Optional fields may be left empty without preventing form submission.
    - If optional fields are filled out, they must still adhere to the specified format and validation rules.
- **Field Rule 7: Numerical Fields**
    - Numerical fields must only accept valid numerical input.
    - If a user enters non-numerical data in a numerical field, they must be notified and prevented from submitting the form.
    - If a user enters a negative number in a field they must be notified and prevented from submitting the form unless the field is explicitly defined to accept negative numbers in the user story or specification.
- **Field Rule 8: Date Fields**
    - Date fields must only accept valid date input in the specified format (e.g., YYYY-MM-DD).
    - If a user enters an invalid date, they must be notified and prevented from submitting the form.
