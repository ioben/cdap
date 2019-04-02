/*
 * Copyright © 2018 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

interface IArtifact {
  name: string;
}

export interface IPipeline {
  name: string;
  artifact: IArtifact;
}

export interface IPipelineStatus {
  status?: string;
  displayStatus?: string;
  lastStarting?: number;
}

export interface IStatusMap {
  [key: string]: IPipelineStatus;
}

export interface IRunsCountMap {
  [key: string]: number;
}
