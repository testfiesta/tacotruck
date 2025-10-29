export const cliDescriptions = {
  TESTFIESTA_MAIN: 'TestFiesta platform specific commands',

  PROJECT_CREATE: 'Create a new project in TestFiesta',
  PROJECT_DELETE: 'Delete a project in TestFiesta',
  PROJECT_LIST: 'List projects in TestFiesta',

  FIELD_CREATE: 'Create a new custom field',
  FIELD_DELETE: 'Delete a custom field',
  FIELD_GET: 'Get a specific custom field by ID',
  FIELD_LIST: 'List custom fields in a project',
  FIELD_UPDATE: 'Update an existing custom field',

  TAG_CREATE: 'Create a new tag',
  TAG_DELETE: 'Delete a tag',
  TAG_GET: 'Get a specific tag by ID',
  TAG_LIST: 'List all tags',
  TAG_UPDATE: 'Update an existing tag',

  TEMPLATE_CREATE: 'Create a new template',
  TEMPLATE_DELETE: 'Delete a template',
  TEMPLATE_GET: 'Get a specific template by ID',
  TEMPLATE_LIST: 'List templates in a project',
  TEMPLATE_UPDATE: 'Update an existing template',

  MILESTONE_CREATE: 'Create a new milestone',
  MILESTONE_DELETE: 'Delete a milestone',
  MILESTONE_GET: 'Get a specific milestone by ID',
  MILESTONE_LIST: 'List milestones in a project',
  MILESTONE_UPDATE: 'Update an existing milestone',

  RUN_SUBMIT: 'Submit test results to TestFiesta',
} as const

export const cliOptions = {
  TOKEN: 'TestFiesta API token',
  URL: 'TestFiesta instance URL (default: https://api.testfiesta.com)',
  ORGANIZATION: 'Organization handle',
  VERBOSE: 'Enable verbose logging',
  NON_INTERACTIVE: 'Skip confirmation prompts (use with caution)',
  LIMIT: 'Number of items to retrieve',
  OFFSET: 'Offset for pagination',

  PROJECT_NAME: 'Project name',
  PROJECT_KEY: 'Project key',

  FIELD_NAME: 'Custom field name',
  FIELD_TYPE: 'Custom field type (text, number, boolean, select, multiselect, date)',
  FIELD_DESCRIPTION: 'Custom field description',
  FIELD_REQUIRED: 'Mark field as required',
  FIELD_DEFAULT_VALUE: 'Default value for the field',
  FIELD_OPTIONS: 'JSON array of options for select/multiselect fields',
  FIELD_ID: 'Custom field ID',

  TAG_NAME: 'Tag name',
  TAG_DESCRIPTION: 'Tag description',
  TAG_COLOR: 'Tag color (hex code, e.g., #FF5733)',
  TAG_ID: 'Tag ID',

  TEMPLATE_NAME: 'Template name',
  TEMPLATE_DESCRIPTION: 'Template description',
  TEMPLATE_CONTENT: 'Template content',
  TEMPLATE_ID: 'Template ID',

  MILESTONE_NAME: 'Milestone name',
  MILESTONE_DESCRIPTION: 'Milestone description',
  MILESTONE_START_DATE: 'Milestone start date (YYYY-MM-DD)',
  MILESTONE_END_DATE: 'Milestone end date (YYYY-MM-DD)',
  MILESTONE_ID: 'Milestone ID',
  MILESTONE_NON_INTERACTIVE: 'Skip interactive prompts for date selection (for CI environments)',

  DATA_FILE: 'Path to the test data file',
  RUN_NAME: 'Name of the test run',
} as const

export const cliMessages = {
  PROJECT_CREATED: 'Project created successfully',
  PROJECT_DELETED: 'Project deleted successfully',
  PROJECT_FETCHED: 'Projects fetched successfully',

  FIELD_CREATED: 'Custom field created successfully',
  FIELD_DELETED: 'Custom field deleted successfully',
  FIELD_UPDATED: 'Custom field updated successfully',
  FIELD_RETRIEVED: 'Custom field retrieved successfully',
  FIELDS_RETRIEVED: 'Custom fields retrieved successfully',

  TAG_CREATED: 'Tag created successfully',
  TAG_DELETED: 'Tag deleted successfully',
  TAG_UPDATED: 'Tag updated successfully',
  TAG_RETRIEVED: 'Tag retrieved successfully',
  TAGS_RETRIEVED: 'Tags retrieved successfully',

  TEMPLATE_CREATED: 'Template created successfully',
  TEMPLATE_DELETED: 'Template deleted successfully',
  TEMPLATE_UPDATED: 'Template updated successfully',
  TEMPLATE_RETRIEVED: 'Template retrieved successfully',
  TEMPLATES_RETRIEVED: 'Templates retrieved successfully',

  MILESTONE_CREATED: 'Milestone created successfully',
  MILESTONE_DELETED: 'Milestone deleted successfully',
  MILESTONE_UPDATED: 'Milestone updated successfully',
  MILESTONE_RETRIEVED: 'Milestone retrieved successfully',
  MILESTONES_RETRIEVED: 'Milestones retrieved successfully',

  PROJECT_CREATE_FAILED: 'Project creation failed',
  PROJECT_DELETE_FAILED: 'Project deletion failed',
  PROJECT_FETCH_FAILED: 'Failed to retrieve projects',

  FIELD_CREATE_FAILED: 'Custom field creation failed',
  FIELD_DELETE_FAILED: 'Custom field deletion failed',
  FIELD_UPDATE_FAILED: 'Custom field update failed',
  FIELD_RETRIEVE_FAILED: 'Failed to retrieve custom field',
  FIELDS_RETRIEVE_FAILED: 'Failed to retrieve custom fields',

  TAG_CREATE_FAILED: 'Tag creation failed',
  TAG_DELETE_FAILED: 'Tag deletion failed',
  TAG_UPDATE_FAILED: 'Tag update failed',
  TAG_RETRIEVE_FAILED: 'Failed to retrieve tag',
  TAGS_RETRIEVE_FAILED: 'Failed to retrieve tags',

  TEMPLATE_CREATE_FAILED: 'Template creation failed',
  TEMPLATE_DELETE_FAILED: 'Template deletion failed',
  TEMPLATE_UPDATE_FAILED: 'Template update failed',
  TEMPLATE_RETRIEVE_FAILED: 'Failed to retrieve template',
  TEMPLATES_RETRIEVE_FAILED: 'Failed to retrieve templates',

  MILESTONE_CREATE_FAILED: 'Milestone creation failed',
  MILESTONE_DELETE_FAILED: 'Milestone deletion failed',
  MILESTONE_UPDATE_FAILED: 'Milestone update failed',
  MILESTONE_RETRIEVE_FAILED: 'Failed to retrieve milestone',
  MILESTONES_RETRIEVE_FAILED: 'Failed to retrieve milestones',

  CREATING_PROJECT: 'Creating project in TestFiesta',
  DELETING_PROJECT: 'Deleting TestFiesta project',
  FETCHING_PROJECTS: 'Fetching projects from TestFiesta',

  CREATING_FIELD: 'Creating custom field',
  DELETING_FIELD: 'Deleting custom field',
  UPDATING_FIELD: 'Updating custom field',
  FETCHING_FIELD: 'Fetching custom field details',
  FETCHING_FIELDS: 'Fetching custom fields',

  CREATING_TAG: 'Creating tag',
  DELETING_TAG: 'Deleting tag',
  UPDATING_TAG: 'Updating tag',
  FETCHING_TAG: 'Fetching tag details',
  FETCHING_TAGS: 'Fetching tags',

  CREATING_TEMPLATE: 'Creating template',
  DELETING_TEMPLATE: 'Deleting template',
  UPDATING_TEMPLATE: 'Updating template',
  FETCHING_TEMPLATE: 'Fetching template details',
  FETCHING_TEMPLATES: 'Fetching templates',

  CREATING_MILESTONE: 'Creating milestone',
  DELETING_MILESTONE: 'Deleting milestone',
  UPDATING_MILESTONE: 'Updating milestone',
  FETCHING_MILESTONE: 'Fetching milestone details',
  FETCHING_MILESTONES: 'Fetching milestones',

  INVALID_COLOR_FORMAT: 'Color must be a valid hex code (e.g., #FF5733)',
  INVALID_OPTIONS_FORMAT: 'Options must be a valid JSON array (e.g., ["Option 1", "Option 2"])',
  NO_UPDATES_PROVIDED: 'No fields to update. Provide at least one field to update.',
  NO_PROJECTS_FOUND: 'No projects found',
  NO_FIELDS_FOUND: 'No custom fields found in this project',
  NO_TAGS_FOUND: 'No tags found',
  NO_TEMPLATES_FOUND: 'No templates found in this project',
  NO_MILESTONES_FOUND: 'No milestones found in this project',
  CONFIRM_DELETE_PROJECT: 'Are you sure you want to delete project',
  CONFIRM_DELETE_FIELD: 'Are you sure you want to delete custom field',
  CONFIRM_DELETE_TAG: 'Are you sure you want to delete tag',
  CONFIRM_DELETE_TEMPLATE: 'Are you sure you want to delete template',
  CONFIRM_DELETE_MILESTONE: 'Are you sure you want to delete milestone',
  DELETE_CANCELLED: 'Deletion cancelled',

  USE_OFFSET: 'Use --offset',
  TO_SEE_MORE: 'to see more results',
} as const

export const cliDefaults = {
  LIMIT: '10',
  OFFSET: '0',
  URL: 'https://api.testfiesta.com',
} as const
