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
 *
 */

package co.cask.cdap.internal.provision.task;

import co.cask.cdap.internal.provision.ProvisioningOp;
import co.cask.cdap.runtime.spi.provisioner.Cluster;
import co.cask.cdap.runtime.spi.provisioner.ClusterStatus;
import co.cask.cdap.runtime.spi.provisioner.Provisioner;
import co.cask.cdap.runtime.spi.provisioner.ProvisionerContext;

import java.util.Optional;
import java.util.function.Function;

/**
 * Provisioning subtask that initializes a cluster.
 */
public class ClusterInitializeSubtask extends ProvisioningSubtask {

  protected ClusterInitializeSubtask(Provisioner provisioner, ProvisionerContext provisionerContext,
                                     Function<Cluster, Optional<ProvisioningOp.Status>> transition) {
    super(provisioner, provisionerContext, transition);
  }

  @Override
  public Cluster execute(Cluster cluster) throws Exception {
    // get the full details, since many times, information like ip addresses is not available until we're done
    // polling for status and are ready to initialize. Up until now, the cluster object is what we got from
    // the original createCluster() call, except with the status updated.
    Cluster fullClusterDetails = provisioner.getClusterDetail(provisionerContext, cluster);
    provisioner.initializeCluster(provisionerContext, fullClusterDetails);
    return new Cluster(fullClusterDetails, ClusterStatus.RUNNING);
  }
}